import os
import re
import json
import time
import random
import datetime
import logging

import requests
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text

from affectlab_user_service import (
    engine,
    get_db,
    get_current_user_id,
    deduct_points_internal,
    _insert_user_transaction,
)

from affectlab_user_service import SessionLocal, ensure_schema

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("AffectLabServer")

app = FastAPI(title="AffectLab Server", description="Gateway + Business Service")

@app.middleware("http")
async def _log_incoming(request: Request, call_next):
    start = time.time()
    rid = f"al_{int(start * 1000)}_{random.randint(1000, 9999)}"
    logger.info("API IN rid=%s method=%s path=%s", rid, request.method, request.url.path)
    resp = await call_next(request)
    logger.info(
        "API OUT rid=%s method=%s path=%s status=%s ms=%s",
        rid,
        request.method,
        request.url.path,
        getattr(resp, "status_code", None),
        int((time.time() - start) * 1000),
    )
    return resp

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from affectlab_user_service import router as user_router

app.include_router(user_router)

@app.on_event("startup")
def _startup_init():
    started = time.time()
    db = None
    try:
        db = SessionLocal()
        ensure_schema(db)
        _sync_templates(db, force=True)
        n = db.execute(text("SELECT COUNT(*) FROM affectlab_emotion_template")).scalar()
        logger.info("STARTUP ok templates=%s ms=%s", int(n or 0), int((time.time() - started) * 1000))
    except Exception as e:
        logger.error("STARTUP failed ms=%s err=%s", int((time.time() - started) * 1000), str(e))
    finally:
        try:
            if db is not None:
                db.close()
        except Exception:
            pass

@app.get("/affectlab/api/health")
def health():
    return {"code": 200, "data": {"ts": int(time.time() * 1000)}}


_BUSINESS_SCHEMA_READY = False


def _ensure_business_schema(db) -> None:
    global _BUSINESS_SCHEMA_READY
    if _BUSINESS_SCHEMA_READY:
        return
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS affectlab_emotion_template (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                template_id VARCHAR(64) NOT NULL,
                title VARCHAR(100) NOT NULL,
                subtitle VARCHAR(100) NULL,
                tag VARCHAR(24) NULL,
                category VARCHAR(24) NULL,
                cost INT NOT NULL DEFAULT 1,
                input_hint VARCHAR(200) NULL,
                quick_prompts JSON NULL,
                description TEXT NULL,
                keywords JSON NULL,
                preset_texts JSON NULL,
                assets JSON NULL,
                status ENUM('active','inactive') DEFAULT 'active',
                sort_order INT DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_template_id (template_id),
                INDEX idx_category (category),
                INDEX idx_tag (tag),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
    )
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS affectlab_emotion_card_record (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                record_id VARCHAR(64) NOT NULL,
                user_id BIGINT NOT NULL,
                template_id VARCHAR(64) NOT NULL,
                user_input TEXT NULL,
                ai_text TEXT NULL,
                rarity ENUM('N','R','SR','SSR') NOT NULL,
                luck_score INT NOT NULL,
                image_url VARCHAR(500) NULL,
                cost_points INT NOT NULL DEFAULT 0,
                meta JSON NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uk_record_id (record_id),
                INDEX idx_user_id (user_id),
                INDEX idx_template_id (template_id),
                INDEX idx_created_at (created_at),
                INDEX idx_rarity (rarity)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
    )
    db.commit()
    _BUSINESS_SCHEMA_READY = True


def _get_random_api_key() -> str | None:
    env_keys = os.getenv("MODELSCOPE_API_KEYS", "") or os.getenv("ALIYUN_API_KEYS", "") or os.getenv("DASHSCOPE_API_KEY", "")
    keys = [k.strip() for k in env_keys.split(",") if k.strip()]
    if not keys:
        return None
    return random.choice(keys)


def _modelscope_chat(messages: list[dict], model: str) -> str | None:
    api_key = _get_random_api_key()
    if not api_key:
        return None
    started_at = time.time()
    r = requests.post(
        "https://api-inference.modelscope.cn/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        data=json.dumps({"model": model, "messages": messages, "stream": False}, ensure_ascii=False).encode("utf-8"),
        timeout=45,
    )
    logger.info("REMOTE ai modelscope chat status=%s ms=%s model=%s", r.status_code, int((time.time() - started_at) * 1000), model)
    r.raise_for_status()
    data = r.json()
    return (data.get("choices") or [{}])[0].get("message", {}).get("content")


def _shorten_text(s: str, max_len: int = 40) -> str:
    s2 = (s or "").strip()
    if len(s2) <= max_len:
        return s2
    return s2[:max_len].rstrip()


def _pick_rarity() -> tuple[str, int]:
    rand = random.random()
    if rand > 0.80:
        return "SSR", 95 + int(random.random() * 6)
    if rand > 0.40:
        return "SR", 80 + int(random.random() * 15)
    if rand > 0.20:
        return "R", 60 + int(random.random() * 20)
    return "N", int(random.random() * 60)


def _parse_js_assets(constants_path: str) -> dict:
    if not os.path.exists(constants_path):
        return {}
    raw = open(constants_path, "r", encoding="utf-8").read()
    start = raw.find("const TEMPLATE_ASSETS = {")
    if start < 0:
        return {}
    end = raw.find("};", start)
    if end < 0:
        return {}
    body = raw[start:end]
    assets: dict[str, dict[str, str]] = {}
    idx = 0
    while True:
        m = re.search(r"'([^']+)'\s*:\s*\{", body[idx:])
        if not m:
            break
        tid = m.group(1)
        block_start = idx + m.end()
        brace = 1
        j = block_start
        while j < len(body) and brace > 0:
            if body[j] == "{":
                brace += 1
            elif body[j] == "}":
                brace -= 1
            j += 1
        block = body[block_start:j - 1]
        per = {}
        for k, v in re.findall(r"\b(N|R|SR|SSR)\s*:\s*'([^']+)'", block):
            per[k] = v
        assets[tid] = per
        idx = j
    return assets


def _parse_js_templates(constants_path: str) -> list[dict]:
    if not os.path.exists(constants_path):
        return []
    raw = open(constants_path, "r", encoding="utf-8").read()
    start = raw.find("const TEMPLATES = [")
    if start < 0:
        return []
    end = raw.find("];", start)
    if end < 0:
        return []
    body = raw[start:end]
    body = re.sub(r"//.*", "", body)
    arr_start = body.find("[")
    arr = body[arr_start + 1 :]

    items: list[dict] = []
    i = 0
    while i < len(arr):
        if arr[i] != "{":
            i += 1
            continue
        brace = 1
        j = i + 1
        while j < len(arr) and brace > 0:
            if arr[j] == "{":
                brace += 1
            elif arr[j] == "}":
                brace -= 1
            j += 1
        obj = arr[i + 1 : j - 1]

        def pick_str(key: str) -> str | None:
            m = re.search(rf"\b{re.escape(key)}\s*:\s*'([^']*)'", obj)
            return m.group(1) if m else None

        def pick_int(key: str) -> int | None:
            m = re.search(rf"\b{re.escape(key)}\s*:\s*(\d+)", obj)
            return int(m.group(1)) if m else None

        def pick_arr(key: str) -> list[str] | None:
            m = re.search(rf"\b{re.escape(key)}\s*:\s*\[([^\]]*)\]", obj, re.S)
            if not m:
                return None
            content = m.group(1)
            return [s for s in re.findall(r"'([^']*)'", content)]

        tid = pick_str("id")
        if tid:
            items.append(
                {
                    "template_id": tid,
                    "title": pick_str("title") or tid,
                    "subtitle": pick_str("subtitle"),
                    "tag": pick_str("tag"),
                    "category": pick_str("category"),
                    "cost": pick_int("cost") or 1,
                    "input_hint": pick_str("inputHint"),
                    "quick_prompts": pick_arr("quickPrompts") or [],
                    "description": pick_str("description"),
                    "keywords": pick_arr("keywords") or [],
                    "preset_texts": pick_arr("presetTexts") or [],
                }
            )
        i = j
    return items


_TEMPLATE_SYNC_AT = 0.0


def _sync_templates(db, force: bool = False) -> None:
    global _TEMPLATE_SYNC_AT
    _ensure_business_schema(db)
    now = time.time()
    if not force and _TEMPLATE_SYNC_AT and (now - _TEMPLATE_SYNC_AT) < 300:
        return
    constants_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "utils", "constants.js"))
    started_at = time.time()
    assets_map = _parse_js_assets(constants_path)
    templates = _parse_js_templates(constants_path)
    if not templates:
        _TEMPLATE_SYNC_AT = now
        logger.info("DB template sync skipped templates=0 ms=%s", int((time.time() - started_at) * 1000))
        return
    for idx, t in enumerate(templates):
        assets = assets_map.get(t["template_id"]) or {}
        db.execute(
            text(
                """
                INSERT INTO affectlab_emotion_template
                (template_id, title, subtitle, tag, category, cost, input_hint, quick_prompts, description, keywords, preset_texts, assets, sort_order)
                VALUES
                (:tid, :title, :subtitle, :tag, :cat, :cost, :hint, :qp, :desc, :kw, :pt, :assets, :sort)
                ON DUPLICATE KEY UPDATE
                    title = VALUES(title),
                    subtitle = VALUES(subtitle),
                    tag = VALUES(tag),
                    category = VALUES(category),
                    cost = VALUES(cost),
                    input_hint = VALUES(input_hint),
                    quick_prompts = VALUES(quick_prompts),
                    description = VALUES(description),
                    keywords = VALUES(keywords),
                    preset_texts = VALUES(preset_texts),
                    assets = VALUES(assets),
                    sort_order = VALUES(sort_order),
                    status = 'active'
                """
            ),
            {
                "tid": t["template_id"],
                "title": t["title"],
                "subtitle": t.get("subtitle"),
                "tag": t.get("tag"),
                "cat": t.get("category"),
                "cost": int(t.get("cost") or 1),
                "hint": t.get("input_hint"),
                "qp": json.dumps(t.get("quick_prompts") or [], ensure_ascii=False),
                "desc": t.get("description"),
                "kw": json.dumps(t.get("keywords") or [], ensure_ascii=False),
                "pt": json.dumps(t.get("preset_texts") or [], ensure_ascii=False),
                "assets": json.dumps(assets, ensure_ascii=False),
                "sort": idx,
            },
        )
    db.commit()
    _TEMPLATE_SYNC_AT = now
    logger.info("DB template sync upserted=%s ms=%s", len(templates), int((time.time() - started_at) * 1000))


class TextPolishRequest(BaseModel):
    inputText: str


@app.post("/affectlab/api/text/polish")
def text_polish(req: TextPolishRequest, request: Request, db=Depends(get_db)):
    _sync_templates(db)
    prompt = (req.inputText or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Empty inputText")

    messages = [
        {
            "role": "system",
            "content": "你是赛博情绪实验室的嘴替引擎。把用户输入改写成三种风格短句（中文优先，每条<=40字）：TOXIC/EMO/GLITCH。输出严格JSON：{options:[{style,text}...],recommendedTemplateId:null或字符串}。不要输出多余字段。",
        },
        {"role": "user", "content": prompt},
    ]

    content = None
    try:
        content = _modelscope_chat(messages, model=os.getenv("AFFECTLAB_TEXT_MODEL", "Qwen/Qwen3-8B-Instruct"))
    except Exception:
        content = None

    if not content:
        raise HTTPException(status_code=503, detail="AI service unavailable")

    try:
        parsed = json.loads(content)
        return parsed
    except Exception:
        return {
            "options": [
                {"style": "TOXIC", "text": _shorten_text(content)},
                {"style": "EMO", "text": _shorten_text(content)},
                {"style": "GLITCH", "text": _shorten_text(content)},
            ],
            "recommendedTemplateId": None,
        }


@app.get("/affectlab/api/templates")
def list_templates(
    kw: str | None = None,
    category: str | None = None,
    tag: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db=Depends(get_db),
):
    _sync_templates(db)
    lim = max(1, min(limit, 200))
    off = max(0, offset)
    where = ["status = 'active'"]
    params: dict = {"lim": lim, "off": off}
    if category:
        where.append("category = :cat")
        params["cat"] = category
    if tag:
        where.append("tag = :tag")
        params["tag"] = tag
    if kw:
        where.append("(template_id LIKE :kw OR title LIKE :kw OR description LIKE :kw OR keywords LIKE :kw)")
        params["kw"] = f"%{kw}%"
    sql = f"""
        SELECT template_id, title, subtitle, tag, category, cost, input_hint, quick_prompts, description, keywords, preset_texts, assets
        FROM affectlab_emotion_template
        WHERE {' AND '.join(where)}
        ORDER BY sort_order ASC, id ASC
        LIMIT :lim OFFSET :off
    """
    rows = db.execute(text(sql), params).mappings().all()
    items = []
    for r in rows:
        d = dict(r)
        for k in ("quick_prompts", "keywords", "preset_texts", "assets"):
            v = d.get(k)
            if isinstance(v, str):
                try:
                    d[k] = json.loads(v)
                except Exception:
                    d[k] = [] if k != "assets" else {}
        items.append(d)
    logger.info("DB read templates count=%s category=%s tag=%s kw=%s", len(items), category or "", tag or "", (kw or "")[:20])
    return {"code": 200, "data": {"items": items}}


class GenerateRequest(BaseModel):
    templateId: str
    userInput: str
    free: bool | None = None


@app.post("/affectlab/api/cards/generate")
def generate_card(req: GenerateRequest, request: Request, db=Depends(get_db)):
    _sync_templates(db)
    user_id = get_current_user_id(request)
    tpl = db.execute(
        text(
            """
            SELECT template_id, title, cost, preset_texts, assets
            FROM affectlab_emotion_template
            WHERE template_id = :tid AND status = 'active'
            LIMIT 1
            """
        ),
        {"tid": req.templateId},
    ).mappings().first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template Not Found")

    cost = int(tpl.get("cost") or 1)
    record_id = f"al_{int(time.time() * 1000)}_{random.randint(1000, 9999)}"
    cost_points = 0 if req.free else cost
    if req.free:
        db.execute(
            text("INSERT IGNORE INTO affectlab_user_balance(user_id, balance) VALUES (:uid, 0)"),
            {"uid": user_id},
        )
        bal = db.execute(text("SELECT balance FROM affectlab_user_balance WHERE user_id = :uid"), {"uid": user_id}).scalar()
        _insert_user_transaction(
            db,
            user_id=user_id,
            amount=0,
            tx_type="REROLL",
            reason="AD",
            project_id=record_id,
            balance_after=int(bal or 0),
        )
        db.commit()
    else:
        deduct_points_internal(db, user_id, cost, reason="GENERATE", project_id=record_id)

    user_input = (req.userInput or "").strip()
    if not user_input:
        raise HTTPException(status_code=400, detail="Empty userInput")

    rarity, luck_score = _pick_rarity()
    assets = tpl.get("assets")
    if isinstance(assets, str):
        try:
            assets = json.loads(assets)
        except Exception:
            assets = {}
    if not isinstance(assets, dict):
        assets = {}
    image_url = assets.get(rarity) or assets.get("SR") or assets.get("R") or assets.get("N") or ""

    ai_text = None
    if req.templateId == "custom-signal":
        ai_text = user_input
    else:
        preset_texts = tpl.get("preset_texts")
        if isinstance(preset_texts, str):
            try:
                preset_texts = json.loads(preset_texts)
            except Exception:
                preset_texts = []
        if isinstance(preset_texts, list) and preset_texts:
            ai_text = str(random.choice(preset_texts))

        if not ai_text:
            messages = [
                {
                    "role": "system",
                    "content": "你是赛博情绪实验室的文案引擎。根据模板主题和用户输入生成一句中文短句（<=40字），风格偏互联网嘴替，直接输出短句，不要解释。",
                },
                {"role": "user", "content": f"模板：{tpl.get('title')}\n用户输入：{user_input}"},
            ]
            try:
                ai_text = _modelscope_chat(messages, model=os.getenv("AFFECTLAB_TEXT_MODEL", "Qwen/Qwen3-8B-Instruct"))
            except Exception:
                ai_text = None

    if not ai_text:
        logger.info("AI fallback to userInput record_id=%s template_id=%s user_id=%s", record_id, req.templateId, int(user_id or 0))

    ai_text = _shorten_text(ai_text or user_input)
    filter_seed = random.randint(0, 359)

    db.execute(
        text(
            """
            INSERT INTO affectlab_emotion_card_record
            (record_id, user_id, template_id, user_input, ai_text, rarity, luck_score, image_url, cost_points, meta)
            VALUES
            (:rid, :uid, :tid, :uin, :txt, :rar, :score, :img, :cost, :meta)
            """
        ),
        {
            "rid": record_id,
            "uid": user_id,
            "tid": req.templateId,
            "uin": user_input,
            "txt": ai_text,
            "rar": rarity,
            "score": int(luck_score),
            "img": image_url,
            "cost": cost_points,
            "meta": json.dumps({"filterSeed": filter_seed}, ensure_ascii=False),
        },
    )
    db.commit()
    logger.info(
        "DB write card_record record_id=%s user_id=%s template_id=%s rarity=%s cost_points=%s",
        record_id,
        int(user_id or 0),
        req.templateId,
        rarity,
        int(cost_points or 0),
    )

    result = {
        "id": record_id,
        "templateId": req.templateId,
        "imageUrl": image_url,
        "text": ai_text,
        "userInput": user_input,
        "timestamp": int(time.time() * 1000),
        "rarity": rarity,
        "filterSeed": filter_seed,
        "luckScore": int(luck_score),
    }
    return {"code": 200, "data": {"result": result}}


@app.get("/affectlab/api/cards")
def list_cards(request: Request, limit: int = 50, offset: int = 0, db=Depends(get_db)):
    user_id = get_current_user_id(request)
    lim = max(1, min(limit, 200))
    off = max(0, offset)
    rows = (
        db.execute(
            text(
                """
                SELECT record_id, template_id, user_input, ai_text, rarity, luck_score, image_url, created_at
                FROM affectlab_emotion_card_record
                WHERE user_id = :uid
                ORDER BY created_at DESC, id DESC
                LIMIT :lim OFFSET :off
                """
            ),
            {"uid": user_id, "lim": lim, "off": off},
        )
        .mappings()
        .all()
    )
    items = []
    for r in rows:
        ts = int(r["created_at"].timestamp() * 1000) if r.get("created_at") else int(time.time() * 1000)
        items.append(
            {
                "id": r["record_id"],
                "templateId": r["template_id"],
                "imageUrl": r.get("image_url") or "",
                "text": r.get("ai_text") or "",
                "userInput": r.get("user_input") or "",
                "timestamp": ts,
                "rarity": r.get("rarity") or "N",
                "filterSeed": 0,
                "luckScore": int(r.get("luck_score") or 0),
            }
        )
    logger.info("DB read cards count=%s user_id=%s", len(items), int(user_id or 0))
    return {"code": 200, "data": {"items": items}}


def _run():
    import uvicorn

    port = int(os.getenv("PORT", "12017"))
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    _run()
