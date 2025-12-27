import os
import json
import datetime
import logging
import time
from urllib.parse import quote_plus

import jwt
import requests
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker


router = APIRouter()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("AffectLabUserService")

def _load_env_file_if_needed() -> None:
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        env_path = os.path.join(base_dir, ".env")
        if not os.path.exists(env_path):
            return
        with open(env_path, "r", encoding="utf-8") as f:
            for raw_line in f:
                line = (raw_line or "").strip()
                if not line or line.startswith("#"):
                    continue
                if "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = (k or "").strip()
                v = (v or "").strip()
                if not k:
                    continue
                if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                    v = v[1:-1]
                os.environ.setdefault(k, v)
    except Exception:
        return

_load_env_file_if_needed()


def _build_db_url() -> str:
    env_database_url = os.environ.get("DATABASE_URL")
    if env_database_url:
        return env_database_url

    host = os.getenv("MYSQL_HOST", "127.0.0.1")
    port = int(os.getenv("MYSQL_PORT", "3306"))
    user = os.getenv("MYSQL_USER", "root")
    password = quote_plus(os.getenv("MYSQL_PASSWORD", ""))
    db = os.getenv("MYSQL_DATABASE", "affect_lab")
    return f"mysql+pymysql://{user}:{password}@{host}:{port}/{db}?charset=utf8mb4&connect_timeout=3&read_timeout=10&write_timeout=10"


DATABASE_URL = _build_db_url()
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_size=5,
    max_overflow=10,
    echo=False,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

THIRD_PARTY_ACCOUNTS_TABLE = os.environ.get("THIRD_PARTY_ACCOUNTS_TABLE", "affectlab_third_party_accounts")

_TABLE_COLUMNS_CACHE: dict[str, set[str]] = {}


def _get_table_columns(db, table_name: str) -> set[str]:
    cached = _TABLE_COLUMNS_CACHE.get(table_name)
    if cached is not None:
        return cached
    rows = db.execute(
        text(
            """
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t
            """
        ),
        {"t": table_name},
    ).fetchall()
    cols = {r[0] for r in rows}
    _TABLE_COLUMNS_CACHE[table_name] = cols
    return cols


_THIRD_PARTY_TABLE_DETECTED = False

def _detect_third_party_table_runtime(db) -> str:
    global THIRD_PARTY_ACCOUNTS_TABLE, _THIRD_PARTY_TABLE_DETECTED
    if _THIRD_PARTY_TABLE_DETECTED and THIRD_PARTY_ACCOUNTS_TABLE:
        return THIRD_PARTY_ACCOUNTS_TABLE
    try:
        for candidate in ("affectlab_third_party_accounts", "third_party_accounts"):
            n = db.execute(
                text(
                    """
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t
                    """
                ),
                {"t": candidate},
            ).scalar()
            if int(n or 0) > 0:
                THIRD_PARTY_ACCOUNTS_TABLE = candidate
                _THIRD_PARTY_TABLE_DETECTED = True
                return candidate
    except Exception:
        pass
    _THIRD_PARTY_TABLE_DETECTED = True
    return THIRD_PARTY_ACCOUNTS_TABLE or "third_party_accounts"


def _insert_third_party_account(db, table_name: str, user_id: int, openid: str, user_info: dict | None) -> None:
    cols = _get_table_columns(db, table_name)
    now = datetime.datetime.utcnow()
    nick = ""
    avatar = ""
    if user_info:
        nick = str(user_info.get("nickName") or "")
        avatar = str(user_info.get("avatarUrl") or "")

    values_by_col = {
        "user_id": int(user_id),
        "open_id": openid,
        "extend_info": json.dumps({"session_key": None}, ensure_ascii=False),
        "union_id": None,
        "nick": nick,
        "avatar": avatar,
        "phone": None,
        "city": None,
        "status": 1,
        "balance": 0,
        "gmt_create": now,
        "gmt_modified": now,
        "created_at": now,
        "updated_at": now,
    }

    insert_cols = [c for c in values_by_col.keys() if c in cols]
    params = {c: values_by_col[c] for c in insert_cols}
    placeholders = ", ".join([f":{c}" for c in insert_cols])
    col_list = ", ".join(insert_cols)
    sql = f"INSERT INTO {table_name} ({col_list}) VALUES ({placeholders})"
    db.execute(text(sql), params)


def _insert_user_transaction(
    db,
    user_id: int,
    amount: int,
    tx_type: str,
    reason: str | None,
    project_id: str | None,
    balance_after: int | None,
) -> None:
    cols = _get_table_columns(db, "user_transactions")
    now = datetime.datetime.utcnow()
    values_by_col = {
        "user_id": int(user_id),
        "amount": int(amount),
        "type": tx_type,
        "reason": reason,
        "project_id": project_id,
        "balance_after": balance_after,
        "created_at": now,
        "create_time": now,
        "gmt_create": now,
    }
    insert_cols = [c for c in values_by_col.keys() if c in cols]
    params = {c: values_by_col[c] for c in insert_cols}
    placeholders = ", ".join([f":{c}" for c in insert_cols])
    col_list = ", ".join(insert_cols)
    sql = f"INSERT INTO user_transactions ({col_list}) VALUES ({placeholders})"
    db.execute(text(sql), params)


def _insert_user_profile(db, phone: str, nick: str, avatar: str) -> None:
    cols = _get_table_columns(db, "user_profile")
    now = datetime.datetime.utcnow()
    values_by_col = {
        "phone": phone,
        "password": "",
        "nick": nick,
        "avatar": avatar,
        "status": 1,
        "create_time": now,
        "modified_time": now,
        "gmt_create": now,
        "gmt_modified": now,
        "created_at": now,
        "updated_at": now,
    }
    insert_cols = [c for c in values_by_col.keys() if c in cols]
    params = {c: values_by_col[c] for c in insert_cols}
    placeholders = ", ".join([f":{c}" for c in insert_cols])
    col_list = ", ".join(insert_cols)
    sql = f"INSERT INTO user_profile ({col_list}) VALUES ({placeholders})"
    db.execute(text(sql), params)


def get_db():
    db = SessionLocal()
    try:
        ensure_schema(db)
        yield db
    finally:
        db.close()


_SCHEMA_READY = False

def ensure_schema(db) -> None:
    global _SCHEMA_READY
    if _SCHEMA_READY:
        return
    third_party_table = _detect_third_party_table_runtime(db)
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS user_profile (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                phone VARCHAR(20) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL DEFAULT '',
                nick VARCHAR(50) DEFAULT '',
                avatar VARCHAR(500) DEFAULT '',
                status INT DEFAULT 1,
                create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                modified_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_phone (phone)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
    )
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS user_transactions (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL,
                amount INT NOT NULL,
                type VARCHAR(20) NOT NULL,
                reason VARCHAR(255) NULL,
                project_id VARCHAR(64) NULL,
                balance_after INT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_id (user_id),
                INDEX idx_type (type),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
    )
    db.execute(
        text(
            f"""
            CREATE TABLE IF NOT EXISTS {third_party_table} (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL,
                open_id VARCHAR(64) NOT NULL,
                extend_info JSON NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uk_open_id (open_id),
                INDEX idx_user_id (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
    )
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS affectlab_user_balance (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL,
                balance INT NOT NULL DEFAULT 0,
                total_recharge INT NOT NULL DEFAULT 0,
                total_consume INT NOT NULL DEFAULT 0,
                last_daily_date VARCHAR(16) NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_user_id (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
    )
    db.commit()
    _SCHEMA_READY = True
    logger.info("DB schema ensured")


SECRET_KEY = os.getenv("SECRET_KEY", "affectlab-secret-key-2025")
WECHAT_APP_ID = os.getenv("WECHAT_APP_ID")
WECHAT_APP_SECRET = os.getenv("WECHAT_APP_SECRET")

def _mask_openid(openid: str | None) -> str:
    s = str(openid or "")
    if len(s) <= 6:
        return "***"
    return f"{s[:3]}***{s[-3:]}"


class LoginRequest(BaseModel):
    code: str
    userInfo: dict | None = None


class RewardRequest(BaseModel):
    amount: int | None = None
    scene: str | None = None
    templateId: str | None = None


def _create_token(user_id: int) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7),
        "iat": datetime.datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def _decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def _get_bearer_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization") or ""
    parts = auth.split(" ", 1)
    if len(parts) != 2:
        return None
    if parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None


def get_current_user_id(request: Request) -> int:
    token = _get_bearer_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Missing Token")
    payload = _decode_token(token)
    if not payload or "user_id" not in payload:
        raise HTTPException(status_code=401, detail="Invalid Token")
    return int(payload["user_id"])


def _get_balance_for_update(db, user_id: int) -> dict:
    rec = db.execute(
        text("SELECT * FROM affectlab_user_balance WHERE user_id = :uid FOR UPDATE"),
        {"uid": user_id},
    ).mappings().first()
    if rec:
        return dict(rec)
    db.execute(
        text("INSERT INTO affectlab_user_balance(user_id, balance) VALUES (:uid, 0)"),
        {"uid": user_id},
    )
    rec2 = db.execute(
        text("SELECT * FROM affectlab_user_balance WHERE user_id = :uid FOR UPDATE"),
        {"uid": user_id},
    ).mappings().first()
    return dict(rec2) if rec2 else {"user_id": user_id, "balance": 0, "total_recharge": 0, "total_consume": 0}


def recharge_points_internal(db, user_id: int, amount: int, reason: str, project_id: str | None = None) -> int:
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    rec = _get_balance_for_update(db, user_id)
    next_balance = int(rec.get("balance") or 0) + amount
    db.execute(
        text(
            """
            UPDATE affectlab_user_balance
            SET balance = :bal, total_recharge = total_recharge + :amt
            WHERE user_id = :uid
            """
        ),
        {"bal": next_balance, "amt": amount, "uid": user_id},
    )
    _insert_user_transaction(
        db,
        user_id=user_id,
        amount=amount,
        tx_type="RECHARGE",
        reason=reason,
        project_id=project_id,
        balance_after=next_balance,
    )
    db.commit()
    logger.info(
        "DB write balance recharge user_id=%s amount=%s reason=%s balance_after=%s project_id=%s",
        int(user_id or 0),
        int(amount or 0),
        str(reason or ""),
        int(next_balance or 0),
        str(project_id or ""),
    )
    return next_balance


def deduct_points_internal(
    db,
    user_id: int,
    amount: int,
    reason: str,
    project_id: str | None = None,
    commit: bool = True,
) -> int:
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    rec = _get_balance_for_update(db, user_id)
    curr = int(rec.get("balance") or 0)
    if curr < amount:
        logger.info(
            "DB write balance deduct denied user_id=%s amount=%s reason=%s balance=%s project_id=%s",
            int(user_id or 0),
            int(amount or 0),
            str(reason or ""),
            int(curr or 0),
            str(project_id or ""),
        )
        raise HTTPException(status_code=400, detail="Insufficient Balance")
    next_balance = curr - amount
    db.execute(
        text(
            """
            UPDATE affectlab_user_balance
            SET balance = :bal, total_consume = total_consume + :amt
            WHERE user_id = :uid
            """
        ),
        {"bal": next_balance, "amt": amount, "uid": user_id},
    )
    _insert_user_transaction(
        db,
        user_id=user_id,
        amount=-amount,
        tx_type="CONSUME",
        reason=reason,
        project_id=project_id,
        balance_after=next_balance,
    )
    if commit:
        db.commit()
    logger.info(
        "DB write balance deduct user_id=%s amount=%s reason=%s balance_after=%s project_id=%s",
        int(user_id or 0),
        int(amount or 0),
        str(reason or ""),
        int(next_balance or 0),
        str(project_id or ""),
    )
    return next_balance


@router.post("/affectlab/api/user/login")
def login(req: LoginRequest, db=Depends(get_db)):
    third_party_table = _detect_third_party_table_runtime(db)
    if not WECHAT_APP_ID or not WECHAT_APP_SECRET:
        raise HTTPException(status_code=500, detail="WeChat Config Missing")

    url = (
        "https://api.weixin.qq.com/sns/jscode2session"
        f"?appid={WECHAT_APP_ID}&secret={WECHAT_APP_SECRET}&js_code={req.code}&grant_type=authorization_code"
    )
    started_at = time.time()
    try:
        res = requests.get(url, timeout=6).json()
    except Exception as e:
        logger.error("REMOTE wechat jscode2session error ms=%s err=%s", int((time.time() - started_at) * 1000), str(e))
        raise HTTPException(status_code=500, detail=f"WeChat API Error: {e}")
    ms = int((time.time() - started_at) * 1000)
    if "errcode" in res and res.get("errcode"):
        logger.info("REMOTE wechat jscode2session fail ms=%s errcode=%s errmsg=%s", ms, res.get("errcode"), res.get("errmsg"))
        raise HTTPException(status_code=400, detail=f"WeChat Login Failed: {res.get('errmsg')}")

    openid = res.get("openid")
    logger.info("REMOTE wechat jscode2session ok ms=%s openid=%s", ms, _mask_openid(openid))
    if not openid:
        raise HTTPException(status_code=500, detail="WeChat openid missing")

    tpa = db.execute(
        text(f"SELECT user_id FROM {third_party_table} WHERE open_id = :oid LIMIT 1"),
        {"oid": openid},
    ).mappings().first()

    user_id = None
    if tpa:
        user_id = int(tpa["user_id"])
    else:
        logger.info("DB write create user profile openid=%s", _mask_openid(openid))
        phone_suffix = openid[-6:] if openid and len(openid) >= 6 else "000000"
        phone = f"wx{phone_suffix}"
        existing = db.execute(text("SELECT id FROM user_profile WHERE phone = :p LIMIT 1"), {"p": phone}).first()
        if existing:
            phone = f"wx{phone_suffix}_{int(datetime.datetime.utcnow().timestamp())}"

        nick = ""
        avatar = ""
        if req.userInfo:
            nick = str(req.userInfo.get("nickName") or "")
            avatar = str(req.userInfo.get("avatarUrl") or "")
        if not nick:
            nick = f"User_{phone_suffix}"

        _insert_user_profile(db, phone=phone, nick=nick, avatar=avatar)
        user_id = int(db.execute(text("SELECT LAST_INSERT_ID()")).scalar() or 0)
        if not user_id:
            raise HTTPException(status_code=500, detail="User create failed")

        _insert_third_party_account(db, third_party_table, user_id, openid, req.userInfo)

        db.execute(
            text(
                """
                INSERT IGNORE INTO affectlab_user_balance(user_id, balance, total_recharge, total_consume)
                VALUES (:uid, :bal, :tr, 0)
                """
            ),
            {"uid": user_id, "bal": 20, "tr": 20},
        )
        _insert_user_transaction(
            db,
            user_id=user_id,
            amount=20,
            tx_type="RECHARGE",
            reason="INIT",
            project_id=None,
            balance_after=20,
        )
        db.commit()

    token = _create_token(user_id)
    bal = db.execute(
        text("SELECT balance FROM affectlab_user_balance WHERE user_id = :uid"),
        {"uid": user_id},
    ).scalar()
    logger.info("API login ok user_id=%s openid=%s", int(user_id or 0), _mask_openid(openid))
    return {
        "code": 200,
        "msg": "Login Success",
        "data": {
            "token": token,
            "user_id": user_id,
            "openid": openid,
            "balance": int(bal or 0),
        },
    }


@router.get("/affectlab/api/user/me")
def me(request: Request, db=Depends(get_db)):
    user_id = get_current_user_id(request)
    user = db.execute(
        text("SELECT id, phone, nick, avatar, status, create_time FROM user_profile WHERE id = :uid LIMIT 1"),
        {"uid": user_id},
    ).mappings().first()
    if not user:
        raise HTTPException(status_code=404, detail="User Not Found")
    bal = db.execute(
        text("SELECT balance, total_recharge, total_consume, last_daily_date FROM affectlab_user_balance WHERE user_id = :uid"),
        {"uid": user_id},
    ).mappings().first()
    if bal:
        sums = db.execute(
            text(
                """
                SELECT
                  COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS tr,
                  COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS tc
                FROM user_transactions
                WHERE user_id = :uid
                """
            ),
            {"uid": user_id},
        ).mappings().first()
        tr = int((sums or {}).get("tr") or 0)
        tc = int((sums or {}).get("tc") or 0)
        cur_tr = int(bal.get("total_recharge") or 0)
        cur_tc = int(bal.get("total_consume") or 0)
        if tr != cur_tr or tc != cur_tc:
            db.execute(
                text("UPDATE affectlab_user_balance SET total_recharge = :tr, total_consume = :tc WHERE user_id = :uid"),
                {"tr": tr, "tc": tc, "uid": user_id},
            )
            db.commit()
            bal = db.execute(
                text("SELECT balance, total_recharge, total_consume, last_daily_date FROM affectlab_user_balance WHERE user_id = :uid"),
                {"uid": user_id},
            ).mappings().first()
    logger.info("DB read user_me user_id=%s", int(user_id or 0))
    return {"code": 200, "data": {"user": dict(user), "balance": dict(bal) if bal else {"balance": 0}}}


@router.get("/affectlab/api/user/balance")
def balance(request: Request, db=Depends(get_db)):
    user_id = get_current_user_id(request)
    bal = db.execute(
        text("SELECT balance FROM affectlab_user_balance WHERE user_id = :uid"),
        {"uid": user_id},
    ).scalar()
    logger.info("DB read user_balance user_id=%s", int(user_id or 0))
    return {"code": 200, "data": {"balance": int(bal or 0)}}


@router.get("/affectlab/api/user/transactions")
def transactions(
    request: Request,
    limit: int = 50,
    offset: int = 0,
    tx_type: str | None = Query(None, alias="type"),
    db=Depends(get_db),
):
    user_id = get_current_user_id(request)
    t = (tx_type or "").strip().upper()
    if t and t not in ("RECHARGE", "CONSUME", "REROLL"):
        raise HTTPException(status_code=400, detail="Invalid type")
    rows = (
        db.execute(
            text(
                """
                SELECT
                  ut.id,
                  ut.amount,
                  ut.type,
                  ut.reason,
                  ut.project_id,
                  ut.balance_after,
                  ut.created_at,
                  COALESCE(cr.template_id, tpl2.template_id) AS template_id,
                  COALESCE(tpl1.title, tpl2.title) AS template_title
                FROM user_transactions ut
                LEFT JOIN affectlab_emotion_card_record cr
                  ON ut.type = 'CONSUME' AND ut.project_id = cr.record_id
                LEFT JOIN affectlab_emotion_template tpl1
                  ON cr.template_id = tpl1.template_id
                LEFT JOIN affectlab_emotion_template tpl2
                  ON ut.type = 'RECHARGE' AND ut.reason = 'AD_REROLL' AND ut.project_id = tpl2.template_id
                WHERE ut.user_id = :uid
                  AND (:t = '' OR ut.type = :t)
                ORDER BY ut.created_at DESC, ut.id DESC
                LIMIT :lim OFFSET :off
                """
            ),
            {"uid": user_id, "t": t, "lim": max(1, min(limit, 200)), "off": max(0, offset)},
        )
        .mappings()
        .all()
    )
    logger.info("DB read user_transactions user_id=%s count=%s", int(user_id or 0), len(rows))
    return {"code": 200, "data": {"items": [dict(r) for r in rows]}}


@router.post("/affectlab/api/user/reward/daily")
def claim_daily(request: Request, db=Depends(get_db)):
    user_id = get_current_user_id(request)
    tz = datetime.timezone(datetime.timedelta(hours=8))
    today = datetime.datetime.now(tz).date().isoformat()
    daily_amount = int(os.getenv("AFFECTLAB_DAILY_REWARD_AMOUNT", "10") or "10")
    rec = _get_balance_for_update(db, user_id)
    if rec.get("last_daily_date") == today:
        logger.info("DB write daily reward denied user_id=%s date=%s", int(user_id or 0), today)
        raise HTTPException(status_code=400, detail="Already claimed")
    curr = int(rec.get("balance") or 0)
    next_balance = curr + daily_amount
    db.execute(
        text(
            """
            UPDATE affectlab_user_balance
            SET balance = :bal,
                total_recharge = total_recharge + :amt,
                last_daily_date = :d
            WHERE user_id = :uid
            """
        ),
        {"bal": next_balance, "amt": daily_amount, "d": today, "uid": user_id},
    )
    _insert_user_transaction(
        db,
        user_id=user_id,
        amount=daily_amount,
        tx_type="RECHARGE",
        reason="DAILY",
        project_id=None,
        balance_after=next_balance,
    )
    db.commit()
    logger.info("DB write daily reward user_id=%s date=%s balance_after=%s", int(user_id or 0), today, int(next_balance or 0))
    return {"code": 200, "data": {"balance": int(next_balance), "amount": int(daily_amount)}}


@router.post("/affectlab/api/user/reward/ad")
def reward_ad(req: RewardRequest, request: Request, db=Depends(get_db)):
    user_id = get_current_user_id(request)
    scene = (req.scene or "").strip().upper()
    ad_amount = int(os.getenv("AFFECTLAB_AD_REWARD_AMOUNT", "10") or "10")

    amount = ad_amount
    reason = "AD"
    project_id = scene or None

    if scene == "REROLL":
        tid = (req.templateId or "").strip()
        cost = None
        if tid:
            cost = db.execute(
                text("SELECT cost FROM affectlab_emotion_template WHERE template_id = :tid LIMIT 1"),
                {"tid": tid},
            ).scalar()
        amount = int(cost or 1)
        reason = "AD_REROLL"
        project_id = tid or None

    next_balance = recharge_points_internal(db, user_id, amount, reason, project_id=project_id)
    logger.info(
        "DB write ad reward user_id=%s scene=%s amount=%s balance_after=%s",
        int(user_id or 0),
        scene or "CANDY",
        int(amount or 0),
        int(next_balance or 0),
    )
    return {"code": 200, "data": {"balance": int(next_balance), "amount": int(amount), "reason": reason}}
