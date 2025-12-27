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

_TEMPLE_FAIR_EVENT_ID = "2026_temple_fair"

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
                content TEXT NULL,
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

    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS affectlab_temple_fair_progress (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL,
                event_id VARCHAR(64) NOT NULL,
                progress JSON NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_user_event (user_id, event_id),
                INDEX idx_user_id (user_id),
                INDEX idx_event_id (event_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
    )

    try:
        has_content = db.execute(
            text(
                """
                SELECT COUNT(*)
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'affectlab_emotion_card_record'
                  AND COLUMN_NAME = 'content'
                """
            )
        ).scalar()
        if not int(has_content or 0):
            db.execute(text("ALTER TABLE affectlab_emotion_card_record ADD COLUMN content TEXT NULL AFTER ai_text"))
    except Exception:
        pass

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


def _deepseek_chat(messages: list[dict], model: str = "deepseek-chat") -> str | None:
    api_key = (os.getenv("DEEPSEEK_API_KEY") or "").strip()
    if not api_key:
        logger.info("REMOTE ai deepseek skipped: missing DEEPSEEK_API_KEY")
        return None
    started_at = time.time()
    try:
        r = requests.post(
            "https://api.deepseek.com/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            data=json.dumps(
                {
                    "model": model,
                    "messages": messages,
                    "stream": False,
                },
                ensure_ascii=False,
            ).encode("utf-8"),
            timeout=30,
        )
        logger.info("REMOTE ai deepseek chat status=%s ms=%s model=%s", r.status_code, int((time.time() - started_at) * 1000), model)
        r.raise_for_status()
        data = r.json()
        return (data.get("choices") or [{}])[0].get("message", {}).get("content")
    except Exception as e:
        logger.error("REMOTE ai deepseek chat error ms=%s err=%s", int((time.time() - started_at) * 1000), str(e))
        return None


def _extract_json_object(s: str) -> str | None:
    if not s:
        return None
    a = s.find("{")
    b = s.rfind("}")
    if a < 0 or b < 0 or b <= a:
        return None
    return s[a : b + 1]


def _sanitize_polish_payload(payload: dict, input_text: str) -> dict:
    opts = payload.get("options")
    if not isinstance(opts, list):
        opts = []
    cleaned = []
    for it in opts:
        if not isinstance(it, dict):
            continue
        style = str(it.get("style") or "").strip().upper()
        txt = _shorten_text(str(it.get("text") or "").strip(), max_len=40)
        if not style or not txt:
            continue
        if style not in ("TOXIC", "EMO", "GLITCH"):
            continue
        cleaned.append({"style": style, "text": txt})
    uniq = {}
    for it in cleaned:
        uniq[it["style"]] = it
    fixed = [uniq.get("TOXIC"), uniq.get("EMO"), uniq.get("GLITCH")]
    fixed = [x for x in fixed if x]

    if len(fixed) < 3:
        base = _shorten_text(input_text, max_len=34)
        fallback = [
            {"style": "TOXIC", "text": _shorten_text(f"{base}？笑死，我先跑路", max_len=40)},
            {"style": "EMO", "text": _shorten_text(f"{base}。夜色替我说完了", max_len=40)},
            {"style": "GLITCH", "text": _shorten_text(f"{base} // SIGNAL_LOST_404", max_len=40)},
        ]
        for it in fallback:
            if it["style"] not in uniq:
                fixed.append(it)
        fixed = fixed[:3]

    rid = payload.get("recommendedTemplateId")
    if rid is not None:
        rid = str(rid).strip() or None
    return {"options": fixed, "recommendedTemplateId": rid}

def _shorten_text(s: str, max_len: int = 40) -> str:
    s2 = (s or "").strip()
    if len(s2) <= max_len:
        return s2
    return s2[:max_len].rstrip()


def _generate_short_content(subject: str, template_id: str, template_title: str, template_category: str, rarity: str) -> str | None:
    subject2 = _shorten_text(subject or "", max_len=60)
    if not subject2:
        return None
    rarity2 = _shorten_text(rarity or "", max_len=8)

    intensity = {
        "N": "低强度：更温和，像状态提示",
        "R": "中低强度：轻度吐槽/调侃，但不攻击人",
        "SR": "中高强度：更利落更带梗，像系统告警/异常回执",
        "SSR": "高强度：警报级、封神、反差梗更强，但不攻击人",
    }.get(str(rarity2).upper(), "低强度：更温和，像状态提示")

    messages = [
        {
            "role": "system",
            "content": (
                "你是「赛博情绪实验室」的文案引擎。任务：根据用户输入的 subject（主题）生成一条卡片短文案，作为“信号回执”。"
                f"强度：{intensity}（稀有度={rarity2}）。"
                "风格：必须是赛博/系统/信号氛围，像系统提示/回执/告警/状态变更，不要鸡汤，不要励志口号。"
                "硬规则（全部必须满足）："
                "1) 只输出一行中文短句，16字以内；不要引号、不要解释、不要 emoji；"
                "2) 必须紧扣 subject 的具体信息：从 subject 里提取 1~2 个具体元素（人/事/物/动作/情绪），并在输出中体现（可同义替换，但不能空泛）；"
                "3) 输出必须像“系统回执/日志”一句话：简短、有动作或状态（已接收/失败/过载/回滚/重试/降级等）；"
                "4) 必须包含至少一个赛博词根：信号/系统/心跳/缓存/权限/告警/断连/重启/过载/掉线/降噪/回滚/补丁/指令/通道/回执/同步；"
                "5) 禁止辱骂、人身攻击、违法暗示。"
                "输出形式（从中任选一种，更像产品）："
                "A) 告警:…  B) 回执:…  C) 状态:…  D) 指令:…  E) 系统:…"
                "强度细则："
                "N：更克制（偏 状态/回执），少用感叹号；"
                "R：轻度玩梗（偏 回执/指令），但别阴阳怪气到攻击人；"
                "SR：更利落更有“异常感”（偏 告警/断连/降噪/回滚）；"
                "SSR：警报级更带梗但不失真（可用更强词：红色告警/权限拒绝/核心崩溃/强制回滚）。"
                "自检：如果不含赛博词根/不贴合subject/超过16字，必须重写后再输出。"
                "示例(仅示例，不可照抄)："
                "老板又加班 -> 加班指令已接收"
                "社恐要去聚会 -> 社交通道降噪失败"
                "被已读不回 -> 回执丢失，重试中"
                "失恋了 -> 心跳系统回滚中"
            ),
        },
        {"role": "user", "content": f"subject：{subject2}\n请输出信号回执："},
    ]
    content = _deepseek_chat(messages, model=os.getenv("AFFECTLAB_CONTENT_MODEL", "deepseek-chat"))
    if not content:
        content = _modelscope_chat(messages, model=os.getenv("AFFECTLAB_TEXT_MODEL", "Qwen/Qwen3-8B-Instruct"))
        if not content:
            return None
    content2 = (content or "").replace("\n", " ").replace("\r", " ").replace('"', "").replace("“", "").replace("”", "").strip()
    if not content2:
        return None
    keywords = ("信号", "系统", "心跳", "缓存", "权限", "告警", "断连", "重启", "过载", "掉线", "降噪", "回滚", "补丁", "指令", "通道", "回执")
    if not any(k in content2 for k in keywords):
        if str(rarity2).upper() in ("SSR", "SR"):
            content2 = f"告警:{content2}"
        else:
            content2 = f"系统:{content2}"
    return _shorten_text(content2, max_len=16) or None


def _fallback_custom_signal_content(subject: str, rarity: str) -> str:
    s = (subject or "").strip()
    if not s:
        return "系统:信号缺失"
    s = _shorten_text(s, max_len=20)
    style = str(rarity or "N").upper()
    if any(k in s for k in ("加班", "熬夜", "通宵", "赶工", "开会")):
        return "加班指令已接收" if style != "SSR" else "告警:加班循环启动"
    if any(k in s for k in ("社恐", "聚会", "社交", "面试", "相亲", "见人")):
        return "社交通道降噪失败" if style != "SSR" else "告警:社交协议过载"
    if any(k in s for k in ("失恋", "分手", "心碎", "拉黑", "前任")):
        return "心跳系统回滚中" if style != "SSR" else "告警:心跳异常回滚"
    if any(k in s for k in ("已读不回", "不回", "被鸽", "冷暴力", "消息")):
        return "回执丢失，重试中" if style != "SSR" else "告警:回执持续丢失"
    if any(k in s for k in ("焦虑", "崩溃", "抑郁", "难受", "emo")):
        return "系统过载，降噪中" if style != "SSR" else "告警:情绪过载掉线"
    if any(k in s for k in ("电量", "没力气", "困", "累", "低能量")):
        return "系统电量告警" if style != "SSR" else "告警:电量濒临掉线"
    return "系统:信号已接收" if style in ("N", "R") else "信号已接收，处理中"


def _pick_rarity() -> tuple[str, int]:
    rand = random.random()
    if rand > 0.80:
        return "SSR", 95 + int(random.random() * 6)
    if rand > 0.40:
        return "SR", 80 + int(random.random() * 15)
    if rand > 0.20:
        return "R", 60 + int(random.random() * 20)
    return "N", int(random.random() * 60)

def _pick_reroll_rarity() -> tuple[str, int]:
    rand = random.random()
    if rand > 0.65:
        return "SSR", 95 + int(random.random() * 6)
    return "SR", 80 + int(random.random() * 15)


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

    prompt2 = _shorten_text(prompt, max_len=120)
    messages = [
        {
            "role": "system",
            "content": (
                "你是赛博情绪实验室的「信号转译」引擎。任务：把用户的原始情绪/事件输入，转译成三条中文短句文案，用于情绪卡片。"
                "必须严格输出 JSON 对象：{\"options\":[{\"style\":\"TOXIC|EMO|GLITCH\",\"text\":\"...\"},...],\"recommendedTemplateId\":null或字符串}。"
                "要求：每条 text 8~40 字；保留用户核心信息但更像“互联网嘴替”；不要解释、不要多余字段、不要 Markdown。"
                "风格：TOXIC=犀利吐槽但不辱骂；EMO=氛围感/诗意/孤独；GLITCH=系统故障/机械抽象。"
            ),
        },
        {"role": "user", "content": prompt2},
    ]

    content = None
    try:
        content = _deepseek_chat(messages, model=os.getenv("AFFECTLAB_POLISH_MODEL", "deepseek-chat"))
    except Exception:
        content = None
    if not content:
        try:
            content = _modelscope_chat(messages, model=os.getenv("AFFECTLAB_TEXT_MODEL", "Qwen/Qwen3-8B-Instruct"))
        except Exception:
            content = None

    if not content:
        return _sanitize_polish_payload({}, prompt2)

    try:
        parsed = json.loads(content)
        if isinstance(parsed, dict):
            return _sanitize_polish_payload(parsed, prompt2)
        return _sanitize_polish_payload({}, prompt2)
    except Exception:
        js = _extract_json_object(content)
        if js:
            try:
                parsed2 = json.loads(js)
                if isinstance(parsed2, dict):
                    return _sanitize_polish_payload(parsed2, prompt2)
            except Exception:
                pass
        return _sanitize_polish_payload({}, prompt2)


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
    reroll: bool | None = None


class TempleFairDailyDrawRequest(BaseModel):
    userInput: str


class TempleFairLanternRequest(BaseModel):
    recordId: str
    title: str | None = None
    isPublic: bool | None = None


class TempleFairStampRequest(BaseModel):
    recordId: str
    boothId: str
    boothLabel: str | None = None
    templateId: str | None = None
    rarity: str | None = None


def _safe_json_loads(s):
    if not s:
        return None
    try:
        return json.loads(s) if isinstance(s, str) else s
    except Exception:
        return None


def _extract_filter_seed(meta) -> int:
    try:
        m = _safe_json_loads(meta)
        if isinstance(m, dict) and "filterSeed" in m:
            return int(m.get("filterSeed") or 0)
    except Exception:
        return 0
    return 0


def _today_str() -> str:
    return datetime.date.today().isoformat()


def _load_temple_fair_progress(db, user_id: int) -> dict:
    _ensure_business_schema(db)
    row = (
        db.execute(
            text(
                """
                SELECT progress
                FROM affectlab_temple_fair_progress
                WHERE user_id = :uid AND event_id = :eid
                LIMIT 1
                """
            ),
            {"uid": int(user_id), "eid": _TEMPLE_FAIR_EVENT_ID},
        )
        .mappings()
        .first()
    )
    raw = row.get("progress") if row else None
    p = _safe_json_loads(raw)
    if not isinstance(p, dict):
        p = {"eventId": _TEMPLE_FAIR_EVENT_ID, "days": [], "updatedAt": int(time.time() * 1000)}
    if not p.get("eventId"):
        p["eventId"] = _TEMPLE_FAIR_EVENT_ID
    if not isinstance(p.get("days"), list):
        p["days"] = []
    if not isinstance(p.get("updatedAt"), int):
        p["updatedAt"] = int(time.time() * 1000)
    return p


def _save_temple_fair_progress(db, user_id: int, progress: dict) -> dict:
    _ensure_business_schema(db)
    p = progress if isinstance(progress, dict) else {"eventId": _TEMPLE_FAIR_EVENT_ID, "days": []}
    if not p.get("eventId"):
        p["eventId"] = _TEMPLE_FAIR_EVENT_ID
    if not isinstance(p.get("days"), list):
        p["days"] = []
    p["updatedAt"] = int(time.time() * 1000)
    payload = json.dumps(p, ensure_ascii=False)
    db.execute(
        text(
            """
            INSERT INTO affectlab_temple_fair_progress(user_id, event_id, progress)
            VALUES (:uid, :eid, :p)
            ON DUPLICATE KEY UPDATE progress = :p
            """
        ),
        {"uid": int(user_id), "eid": _TEMPLE_FAIR_EVENT_ID, "p": payload},
    )
    db.commit()
    return p


def _ensure_today_entry(progress: dict, today: str) -> tuple[dict, dict]:
    p = progress if isinstance(progress, dict) else {"eventId": _TEMPLE_FAIR_EVENT_ID, "days": []}
    days = p.get("days") if isinstance(p.get("days"), list) else []
    entry = next((x for x in days if isinstance(x, dict) and x.get("date") == today), None)
    if not entry:
        entry = {"date": today, "sign": None, "lantern": None, "stamp": None}
        p["days"] = [entry] + [x for x in days if isinstance(x, dict)][:59]
    return p, entry


_PUBLIC_LANTERN_ALLOWED_TEMPLATES: set[str] = {"custom-signal"}

_PUBLIC_LANTERN_BLOCK_TITLE_PATTERNS = [
    re.compile(r"(https?://|www\.)", re.I),
    re.compile(r"\b[a-z0-9-]+\.(com|cn|net|org|io|cc)\b", re.I),
    re.compile(r"(?:\+?86[-\s]?)?1[3-9]\d{9}"),
    re.compile(r"(微信|vx|v信|wechat|qq|加群|群号|私聊|联系我)", re.I),
]


def _sanitize_lantern_title(raw_title: str | None) -> str:
    t = str(raw_title or "").replace("\r", " ").replace("\n", " ").strip()
    t = re.sub(r"\s+", " ", t)
    if not t:
        t = "香火已上链"
    return t[:20]


def _is_risky_public_lantern_title(title: str) -> bool:
    t = str(title or "").strip()
    if not t:
        return False
    for pat in _PUBLIC_LANTERN_BLOCK_TITLE_PATTERNS:
        if pat.search(t):
            return True
    return False


def _build_card_result_from_record(r: dict) -> dict:
    ts = int(r["created_at"].timestamp() * 1000) if r.get("created_at") else int(time.time() * 1000)
    return {
        "id": r["record_id"],
        "templateId": r.get("template_id") or "",
        "imageUrl": r.get("image_url") or "",
        "text": r.get("ai_text") or "",
        "content": r.get("content") or "",
        "userInput": r.get("user_input") or "",
        "timestamp": ts,
        "rarity": r.get("rarity") or "N",
        "filterSeed": _extract_filter_seed(r.get("meta")),
        "luckScore": int(r.get("luck_score") or 0),
    }


def _build_public_card_result_from_record(r: dict, public_subject: str = "") -> dict:
    ts = int(r["created_at"].timestamp() * 1000) if r.get("created_at") else int(time.time() * 1000)
    template_id = r.get("template_id") or ""
    ai_text = str(r.get("ai_text") or "")
    content = str(r.get("content") or "")
    if template_id == "custom-signal":
        ai_text = ""
    else:
        content = ""
    subject = _sanitize_lantern_title(public_subject) if public_subject else ""
    if not subject:
        subject = "匿名香客"
    return {
        "id": r["record_id"],
        "templateId": template_id,
        "imageUrl": r.get("image_url") or "",
        "text": ai_text,
        "content": content,
        "userInput": subject,
        "timestamp": ts,
        "rarity": r.get("rarity") or "N",
        "filterSeed": _extract_filter_seed(r.get("meta")),
        "luckScore": int(r.get("luck_score") or 0),
    }


@app.post("/affectlab/api/cards/generate")
def generate_card(req: GenerateRequest, request: Request, db=Depends(get_db)):
    _sync_templates(db)
    user_id = get_current_user_id(request)
    tpl = db.execute(
        text(
            """
            SELECT template_id, title, category, cost, preset_texts, assets
            FROM affectlab_emotion_template
            WHERE template_id = :tid AND status = 'active'
            LIMIT 1
            """
        ),
        {"tid": req.templateId},
    ).mappings().first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template Not Found")

    user_input = (req.userInput or "").strip()
    if not user_input:
        raise HTTPException(status_code=400, detail="Empty userInput")

    cost = int(tpl.get("cost") or 1)
    record_id = f"al_{int(time.time() * 1000)}_{random.randint(1000, 9999)}"
    is_free = bool(req.free)
    is_reroll = bool(req.reroll)
    cost_points = 0 if is_free else cost
    balance_after = None
    rarity = "N"
    luck_score = 0
    image_url = ""
    ai_text = ""
    content_text = None
    filter_seed = 0
    try:
        if is_free:
            db.execute(
                text("INSERT IGNORE INTO affectlab_user_balance(user_id, balance) VALUES (:uid, 0)"),
                {"uid": user_id},
            )
            bal = db.execute(text("SELECT balance FROM affectlab_user_balance WHERE user_id = :uid"), {"uid": user_id}).scalar()
            balance_after = int(bal or 0)
            _insert_user_transaction(
                db,
                user_id=user_id,
                amount=0,
                tx_type="REROLL",
                reason="AD",
                project_id=record_id,
                balance_after=balance_after,
            )
        else:
            balance_after = deduct_points_internal(
                db,
                user_id,
                cost,
                reason="REROLL_GENERATE" if is_reroll else "GENERATE",
                project_id=record_id,
                commit=False,
            )

        rarity, luck_score = _pick_rarity()
        if (is_free or is_reroll) and rarity in ("N", "R"):
            rarity, luck_score = _pick_reroll_rarity()

        if req.templateId == "custom-signal":
            content_text = _generate_short_content(
                user_input,
                req.templateId,
                template_title=str(tpl.get("title") or ""),
                template_category=str(tpl.get("category") or ""),
                rarity=rarity,
            )
            if not content_text:
                content_text = _fallback_custom_signal_content(user_input, rarity)
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
                ai_text = user_input

        if not ai_text:
            logger.info(
                "AI fallback to userInput record_id=%s template_id=%s user_id=%s",
                record_id,
                req.templateId,
                int(user_id or 0),
            )

        ai_text = _shorten_text(ai_text or user_input)
        filter_seed = random.randint(0, 359)

        db.execute(
            text(
                """
                INSERT INTO affectlab_emotion_card_record
                (record_id, user_id, template_id, user_input, ai_text, content, rarity, luck_score, image_url, cost_points, meta)
                VALUES
                (:rid, :uid, :tid, :uin, :txt, :content, :rar, :score, :img, :cost, :meta)
                """
            ),
            {
                "rid": record_id,
                "uid": user_id,
                "tid": req.templateId,
                "uin": user_input,
                "txt": ai_text,
                "content": content_text,
                "rar": rarity,
                "score": int(luck_score),
                "img": image_url,
                "cost": cost_points,
                "meta": json.dumps({"filterSeed": filter_seed, "reroll": bool(is_reroll), "free": bool(is_free)}, ensure_ascii=False),
            },
        )
        db.commit()
    except HTTPException:
        try:
            db.rollback()
        except Exception:
            pass
        raise
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        logger.error("Generate failed record_id=%s err=%s", record_id, str(e))
        raise HTTPException(status_code=500, detail="Generate Failed")
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
        "content": content_text or "",
        "userInput": user_input,
        "timestamp": int(time.time() * 1000),
        "rarity": rarity,
        "filterSeed": filter_seed,
        "luckScore": int(luck_score),
    }
    return {"code": 200, "data": {"result": result, "balance": int(balance_after or 0)}}


@app.get("/affectlab/api/cards")
def list_cards(
    request: Request,
    limit: int = 10,
    offset: int = 0,
    kw: str | None = None,
    category: str | None = None,
    rarity: str | None = None,
    db=Depends(get_db),
):
    _ensure_business_schema(db)
    user_id = get_current_user_id(request)
    lim = max(1, min(limit, 200))
    off = max(0, offset)
    kw2 = (kw or "").strip()
    cat2 = (category or "").strip()
    rar2 = (rarity or "").strip().upper()
    if rar2 and rar2 not in ("N", "R", "SR", "SSR"):
        raise HTTPException(status_code=400, detail="Invalid rarity")

    where = ["r.user_id = :uid"]
    params: dict = {"uid": user_id, "lim": lim, "off": off, "kw": "", "cat": "", "rar": ""}
    if rar2:
        where.append("r.rarity = :rar")
        params["rar"] = rar2
    if cat2:
        where.append("t.category = :cat")
        params["cat"] = cat2
    if kw2:
        params["kw"] = f"%{kw2}%"
        where.append(
            "("
            "r.template_id LIKE :kw OR "
            "t.title LIKE :kw OR "
            "t.tag LIKE :kw OR "
            "t.category LIKE :kw OR "
            "r.user_input LIKE :kw OR "
            "r.ai_text LIKE :kw OR "
            "r.content LIKE :kw"
            ")"
        )

    where_sql = " AND ".join(where)
    total = int(
        db.execute(
            text(
                f"""
                SELECT COUNT(*)
                FROM affectlab_emotion_card_record r
                LEFT JOIN affectlab_emotion_template t ON r.template_id = t.template_id
                WHERE {where_sql}
                """
            ),
            params,
        ).scalar()
        or 0
    )
    rows = (
        db.execute(
            text(
                """
                SELECT
                  r.record_id,
                  r.template_id,
                  r.user_input,
                  r.ai_text,
                  r.content,
                  r.rarity,
                  r.luck_score,
                  r.image_url,
                  r.meta,
                  r.created_at,
                  t.title AS template_title,
                  t.category AS template_category,
                  t.tag AS template_tag
                FROM affectlab_emotion_card_record r
                LEFT JOIN affectlab_emotion_template t ON r.template_id = t.template_id
                WHERE """
                + where_sql
                + """
                ORDER BY r.created_at DESC, r.id DESC
                LIMIT :lim OFFSET :off
                """
            ),
            params,
        )
        .mappings()
        .all()
    )
    items = []
    for r in rows:
        ts = int(r["created_at"].timestamp() * 1000) if r.get("created_at") else int(time.time() * 1000)
        filter_seed = 0
        try:
            meta = r.get("meta")
            if meta:
                m = json.loads(meta) if isinstance(meta, str) else meta
                if isinstance(m, dict) and "filterSeed" in m:
                    filter_seed = int(m.get("filterSeed") or 0)
        except Exception:
            filter_seed = 0
        items.append(
                    {
                        "id": r["record_id"],
                        "templateId": r["template_id"],
                        "templateTitle": r.get("template_title") or "",
                        "templateCategory": r.get("template_category") or "",
                        "templateTag": r.get("template_tag") or "",
                        "imageUrl": r.get("image_url") or "",
                        "text": r.get("ai_text") or "",
                        "content": r.get("content") or "",
                        "userInput": r.get("user_input") or "",
                        "timestamp": ts,
                        "rarity": r.get("rarity") or "N",
                        "filterSeed": filter_seed,
                "luckScore": int(r.get("luck_score") or 0),
            }
        )
    logger.info(
        "DB read cards count=%s total=%s user_id=%s kw=%s category=%s rarity=%s",
        len(items),
        int(total or 0),
        int(user_id or 0),
        (kw2 or "")[:20],
        cat2,
        rar2,
    )
    return {"code": 200, "data": {"items": items, "total": int(total or 0)}}


@app.get("/affectlab/api/event/temple_fair/status")
def temple_fair_status(request: Request, db=Depends(get_db)):
    user_id = get_current_user_id(request)
    progress = _load_temple_fair_progress(db, user_id)
    return {"code": 200, "data": {"progress": progress}}


@app.post("/affectlab/api/event/temple_fair/daily_draw")
def temple_fair_daily_draw(req: TempleFairDailyDrawRequest, request: Request, db=Depends(get_db)):
    user_id = get_current_user_id(request)
    today = _today_str()
    progress = _load_temple_fair_progress(db, user_id)
    progress, entry = _ensure_today_entry(progress, today)
    sign = entry.get("sign") if isinstance(entry, dict) else None
    if isinstance(sign, dict) and sign.get("recordId"):
        row = (
            db.execute(
                text(
                    """
                    SELECT record_id, template_id, user_input, ai_text, content, rarity, luck_score, image_url, meta, created_at
                    FROM affectlab_emotion_card_record
                    WHERE user_id = :uid AND record_id = :rid
                    LIMIT 1
                    """
                ),
                {"uid": int(user_id), "rid": str(sign.get("recordId"))},
            )
            .mappings()
            .first()
        )
        if row:
            bal = db.execute(text("SELECT balance FROM affectlab_user_balance WHERE user_id = :uid"), {"uid": user_id}).scalar()
            return {"code": 200, "data": {"result": _build_card_result_from_record(dict(row)), "balance": int(bal or 0)}}

    gen = generate_card(
        GenerateRequest(templateId="custom-signal", userInput=req.userInput, free=True, reroll=False),
        request,
        db,
    )
    result = gen.get("data", {}).get("result") if isinstance(gen, dict) else None
    if isinstance(result, dict) and result.get("id"):
        entry["sign"] = {
            "recordId": result.get("id") or "",
            "text": (str(result.get("content") or "").strip() or str(result.get("text") or "").strip()),
            "content": result.get("content") or "",
            "userInput": result.get("userInput") or "",
            "imageUrl": result.get("imageUrl") or "",
            "timestamp": int(result.get("timestamp") or int(time.time() * 1000)),
            "rarity": result.get("rarity") or "N",
            "filterSeed": int(result.get("filterSeed") or 0),
            "luckScore": int(result.get("luckScore") or 0),
        }
        _save_temple_fair_progress(db, user_id, progress)
    return gen


@app.post("/affectlab/api/event/temple_fair/lantern")
def temple_fair_lantern(req: TempleFairLanternRequest, request: Request, db=Depends(get_db)):
    user_id = get_current_user_id(request)
    rid = (req.recordId or "").strip()
    if not rid:
        raise HTTPException(status_code=400, detail="Empty recordId")
    row = (
        db.execute(
            text(
                """
                SELECT record_id, template_id
                FROM affectlab_emotion_card_record
                WHERE user_id = :uid AND record_id = :rid
                LIMIT 1
                """
            ),
            {"uid": int(user_id), "rid": rid},
        )
        .mappings()
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Record Not Found")
    template_id = str(row.get("template_id") or "").strip()
    if template_id not in _PUBLIC_LANTERN_ALLOWED_TEMPLATES:
        raise HTTPException(status_code=400, detail="Invalid record template")

    is_public = bool(req.isPublic)
    title = _sanitize_lantern_title(req.title)
    if is_public and _is_risky_public_lantern_title(title):
        raise HTTPException(status_code=400, detail="Unsafe title")

    today = _today_str()
    progress = _load_temple_fair_progress(db, user_id)
    progress, entry = _ensure_today_entry(progress, today)
    sign = entry.get("sign") if isinstance(entry, dict) else None
    sign_rid = str(sign.get("recordId") or "").strip() if isinstance(sign, dict) else ""
    if not sign_rid:
        raise HTTPException(status_code=400, detail="Sign Not Completed")
    if sign_rid != rid:
        raise HTTPException(status_code=400, detail="RecordId Not Today's Sign")
    entry["lantern"] = {"recordId": rid, "title": title, "isPublic": is_public}
    saved = _save_temple_fair_progress(db, user_id, progress)
    return {"code": 200, "data": {"progress": saved}}


@app.post("/affectlab/api/event/temple_fair/stamp")
def temple_fair_stamp(req: TempleFairStampRequest, request: Request, db=Depends(get_db)):
    user_id = get_current_user_id(request)
    rid = (req.recordId or "").strip()
    if not rid:
        raise HTTPException(status_code=400, detail="Empty recordId")
    exists = db.execute(
        text("SELECT 1 FROM affectlab_emotion_card_record WHERE user_id = :uid AND record_id = :rid LIMIT 1"),
        {"uid": int(user_id), "rid": rid},
    ).first()
    if not exists:
        raise HTTPException(status_code=404, detail="Record Not Found")

    booth_id = (req.boothId or "").strip()
    if not booth_id:
        raise HTTPException(status_code=400, detail="Empty boothId")

    booth_label = (req.boothLabel or "").strip()[:20]
    template_id = (req.templateId or "").strip()[:64]
    rarity = (req.rarity or "").strip()[:8]

    today = _today_str()
    progress = _load_temple_fair_progress(db, user_id)
    progress, entry = _ensure_today_entry(progress, today)
    entry["stamp"] = {
        "recordId": rid,
        "boothId": booth_id,
        "boothLabel": booth_label,
        "templateId": template_id,
        "rarity": rarity,
    }
    saved = _save_temple_fair_progress(db, user_id, progress)
    return {"code": 200, "data": {"progress": saved}}


def _read_public_lantern_index(db, scan_rows: int) -> list[dict]:
    _ensure_business_schema(db)
    n = max(1, min(int(scan_rows or 0), 5000))
    rows = (
        db.execute(
            text(
                """
                SELECT progress, updated_at
                FROM affectlab_temple_fair_progress
                WHERE event_id = :eid
                ORDER BY updated_at DESC
                LIMIT :lim
                """
            ),
            {"eid": _TEMPLE_FAIR_EVENT_ID, "lim": n},
        )
        .mappings()
        .all()
    )
    items: list[dict] = []
    seen: set[str] = set()
    for r in rows:
        p = _safe_json_loads(r.get("progress"))
        if not isinstance(p, dict):
            continue
        updated_at = r.get("updated_at")
        updated_ms = int(updated_at.timestamp() * 1000) if updated_at else int(time.time() * 1000)
        days = p.get("days")
        if not isinstance(days, list):
            continue
        for d in days:
            if not isinstance(d, dict):
                continue
            lantern = d.get("lantern")
            if not isinstance(lantern, dict):
                continue
            if not bool(lantern.get("isPublic")):
                continue
            rid = str(lantern.get("recordId") or "").strip()
            if not rid or rid in seen:
                continue
            title = _sanitize_lantern_title(lantern.get("title"))
            if _is_risky_public_lantern_title(title):
                continue
            seen.add(rid)
            items.append(
                {
                    "recordId": rid,
                    "title": title,
                    "date": str(d.get("date") or ""),
                    "updatedAt": updated_ms,
                }
            )
    items.sort(key=lambda x: ((x.get("date") or ""), int(x.get("updatedAt") or 0)), reverse=True)
    return items


def _fetch_records_by_ids(db, record_ids: list[str]) -> dict[str, dict]:
    ids: list[str] = []
    for x in (record_ids or []):
        if x is None:
            continue
        s = str(x).strip()
        if s and s.lower() != "none":
            ids.append(s)
    if not ids:
        return {}
    placeholders = ", ".join([f":rid{i}" for i in range(len(ids))])
    params = {f"rid{i}": ids[i] for i in range(len(ids))}
    sql = f"""
        SELECT record_id, template_id, user_input, ai_text, content, rarity, luck_score, image_url, meta, created_at
        FROM affectlab_emotion_card_record
        WHERE record_id IN ({placeholders})
    """
    rows = db.execute(text(sql), params).mappings().all()
    return {str(r.get("record_id") or ""): dict(r) for r in rows if r and r.get("record_id")}


@app.get("/affectlab/api/event/temple_fair/lanterns/public")
def temple_fair_public_lanterns(limit: int = 20, offset: int = 0, db=Depends(get_db)):
    lim = max(1, min(int(limit or 0), 50))
    off = max(0, int(offset or 0))
    idx = _read_public_lantern_index(db, scan_rows=2000)
    page = idx[off : off + lim]
    record_map = _fetch_records_by_ids(db, [x.get("recordId") for x in page])
    items: list[dict] = []
    for x in page:
        rid = str(x.get("recordId") or "")
        rec = record_map.get(rid)
        if not rec:
            continue
        template_id = str(rec.get("template_id") or "").strip()
        if template_id not in _PUBLIC_LANTERN_ALLOWED_TEMPLATES:
            continue
        items.append(
            {
                "recordId": rid,
                "title": x.get("title") or "",
                "date": x.get("date") or "",
                "updatedAt": int(x.get("updatedAt") or 0),
                "result": _build_public_card_result_from_record(rec, public_subject=str(x.get("title") or "")),
            }
        )
    return {"code": 200, "data": {"items": items, "offset": off, "limit": lim}}


@app.get("/affectlab/api/event/temple_fair/stats")
def temple_fair_stats(db=Depends(get_db)):
    _ensure_business_schema(db)
    users = db.execute(
        text("SELECT COUNT(*) FROM affectlab_temple_fair_progress WHERE event_id = :eid"),
        {"eid": _TEMPLE_FAIR_EVENT_ID},
    ).scalar()
    today = _today_str()
    idx = _read_public_lantern_index(db, scan_rows=2000)
    today_public = sum(1 for x in idx if (x.get("date") or "") == today)

    today_sign = 0
    today_stamp = 0
    try:
        rows = (
            db.execute(
                text(
                    """
                    SELECT progress
                    FROM affectlab_temple_fair_progress
                    WHERE event_id = :eid
                    ORDER BY updated_at DESC
                    LIMIT 2000
                    """
                ),
                {"eid": _TEMPLE_FAIR_EVENT_ID},
            )
            .mappings()
            .all()
        )
        for r in rows:
            p = _safe_json_loads(r.get("progress"))
            if not isinstance(p, dict):
                continue
            days = p.get("days")
            if not isinstance(days, list):
                continue
            entry = next((d for d in days if isinstance(d, dict) and d.get("date") == today), None)
            if not entry:
                continue
            sign = entry.get("sign")
            if isinstance(sign, dict) and str(sign.get("recordId") or "").strip():
                today_sign += 1
            stamp = entry.get("stamp")
            if isinstance(stamp, dict) and str(stamp.get("recordId") or "").strip():
                today_stamp += 1
    except Exception:
        today_sign = 0
        today_stamp = 0

    return {
        "code": 200,
        "data": {
            "eventId": _TEMPLE_FAIR_EVENT_ID,
            "today": today,
            "users": int(users or 0),
            "publicLanterns": int(len(idx)),
            "todayPublicLanterns": int(today_public),
            "todaySigns": int(today_sign),
            "todayStamps": int(today_stamp),
        },
    }


def _run():
    import uvicorn

    port = int(os.getenv("PORT", "12017"))
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    _run()
