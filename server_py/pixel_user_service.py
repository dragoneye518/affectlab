from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
import os
import jwt
import datetime
import datetime
import requests
import json
from sqlalchemy.orm import Session
try:
    from mysql_config import get_db, SessionLocal
    from pixel_models import UserProfile, UserBalance, UserProject, ThirdPartyAccount, UserTransaction, BusinessPromptStyleTemplate
except ImportError:
    from .mysql_config import get_db, SessionLocal
    from .pixel_models import UserProfile, UserBalance, UserProject, ThirdPartyAccount, UserTransaction, BusinessPromptStyleTemplate

router = APIRouter()

# ... (imports remain same)

# Config
SECRET_KEY = os.getenv('SECRET_KEY', 'candy-pixel-secret-key-2025')
WECHAT_APP_ID = os.getenv('WECHAT_APP_ID')
WECHAT_APP_SECRET = os.getenv('WECHAT_APP_SECRET')

# Models
class LoginRequest(BaseModel):
    code: str
    userInfo: dict | None = None

class TokenVerifyRequest(BaseModel):
    token: str

class DeductRequest(BaseModel):
    amount: int
    reason: str | None = None
    project_id: str | None = None

# Utils
def creating_token(user_id: int):
    payload = {
        'user_id': user_id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7),
        'iat': datetime.datetime.utcnow()
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

def decode_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

# Internal Logic Helpers
def get_user_by_token(token: str, db: Session):
    payload = decode_token(token)
    if not payload:
        print(f"[Auth Debug] Token decode returned None. Token: {token[:10]}...")
        return None
    
    try:
        user = db.query(UserProfile).filter(UserProfile.id == payload['user_id']).first()
        if not user:
                print(f"[Auth Debug] User not found for ID: {payload.get('user_id')}")
        return user
    except Exception as e:
        print(f"[Auth Debug] DB Error in get_user_by_token: {e}")
        raise e  # Propagate error to cause 500, not 401

def deduct_balance_internal(user_id: int, amount: int, reason: str, project_id: str | None, db: Session):
    rec = db.query(UserBalance).filter(UserBalance.user_id == user_id).with_for_update().first()
    if not rec or rec.balance < amount:
        return False, "Insufficient Balance"
    
    rec.balance -= amount
    rec.total_consume += amount
    
    # Log Transaction
    log = UserTransaction(
        user_id=user_id,
        amount=-amount,
        type='CONSUME',
        reason=reason,
        project_id=project_id,
        balance_after=rec.balance
    )
    db.add(log)
    
    db.commit()
    return True, rec.balance

def recharge_balance_internal(user_id: int, amount: int, reason: str, db: Session):
    rec = db.query(UserBalance).filter(UserBalance.user_id == user_id).with_for_update().first()
    if not rec:
        # Should create if not exists, but usually created at register
        return False, "User Balance Record Not Found"
        
    rec.balance += amount
    rec.total_recharge += amount
    
    # Log Transaction
    log = UserTransaction(
        user_id=user_id,
        amount=amount,
        type='RECHARGE',
        reason=reason,
        balance_after=rec.balance
    )
    db.add(log)
    db.commit()
    return True, rec.balance

@router.post("/candypixel/api/user/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    print(f"[AUTH] Login Request: code={req.code}")
    
    # Check Environment
    if not WECHAT_APP_ID or not WECHAT_APP_SECRET:
        print(f"[AUTH] WARNING: WeChat App ID or Secret missing. Running in MOCK mode.")
        if not WECHAT_APP_ID and not WECHAT_APP_SECRET:
             pass 
        else:
            print(f"[AUTH] ERROR: Partial config - AppID={WECHAT_APP_ID}, Secret={WECHAT_APP_SECRET}")
            raise HTTPException(status_code=500, detail="WeChat Config Missing")

    openid = None
    if WECHAT_APP_ID:
        url = f"https://api.weixin.qq.com/sns/jscode2session?appid={WECHAT_APP_ID}&secret={WECHAT_APP_SECRET}&js_code={req.code}&grant_type=authorization_code"
        try:
            print(f"[AUTH] Calling WeChat API: {url.replace(WECHAT_APP_SECRET, '***')}")
            res = requests.get(url, timeout=5).json()
            print(f"[AUTH] WeChat API Response: {res}")
        except Exception as e:
            print(f"[AUTH] WeChat API Error: {e}")
            raise HTTPException(status_code=500, detail=f"WeChat API Error: {e}")

        if "errcode" in res and res["errcode"] != 0:
            print(f"[AUTH] WeChat Login Failed: {res}")
            raise HTTPException(status_code=400, detail=f"WeChat Login Failed: {res.get('errmsg')}")

        openid = res.get("openid")
        print(f"[AUTH] Got OpenID: {openid}")
    else:
        # Mock logic
        # If the code starts with 'MOCK_USER_', use it as the stable openid suffix
        if req.code.startswith('MOCK_USER_'):
            openid = f"mock_openid_{req.code}"
        else:
            # Standard mock logic: unique per code
            openid = f"mock_openid_{req.code}"
        print(f"[AUTH] Generated Mock OpenID: {openid}")

    # Find User via ThirdPartyAccount
    tpa = db.query(ThirdPartyAccount).filter(ThirdPartyAccount.open_id == openid).first()
    
    user = None
    if tpa:
        print(f"[AUTH] Found existing ThirdPartyAccount for openid={openid}, user_id={tpa.user_id}")
        user = db.query(UserProfile).filter(UserProfile.id == tpa.user_id).first()
    else:
        print(f"[AUTH] No ThirdPartyAccount found for openid={openid}")
    
    if not user:
        print(f"[AUTH] Creating new user for openid={openid}")
        import time
        phone_suffix = openid[-6:] if len(openid) >= 6 else openid
        
        # Ensure unique phone
        phone = f"wx{phone_suffix}"
        while db.query(UserProfile).filter(UserProfile.phone == phone).first():
            # Use last 8 digits of timestamp to keep it short
            ts_suffix = str(int(time.time()))[-8:] 
            phone = f"wx{phone_suffix[:4]}_{ts_suffix}" # 2+4+1+8 = 15 chars
            
        user = UserProfile(
            phone=phone,
            password='',
            nick=req.userInfo.get('nickName', f'User_{phone_suffix}') if req.userInfo else f'User_{phone_suffix}',
            avatar=req.userInfo.get('avatarUrl', '') if req.userInfo else '',
            status=1
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Link ThirdPartyAccount
        tpa = ThirdPartyAccount(
            user_id=user.id,
            open_id=openid,
            extend_info=json.dumps({"session_key": None, "domain": "candyaix"})
        )
        db.add(tpa)
        
        # Init Balance - 新用户初始积分1000
        balance = UserBalance(user_id=user.id, balance=1000, total_recharge=0, total_consume=0) 
        db.add(balance)
        db.commit()

    token = creating_token(user.id)
    balance_record = db.query(UserBalance).filter(UserBalance.user_id == user.id).first()
    curr_balance = balance_record.balance if balance_record else 0

    return {
        "code": 200,
        "msg": "Login Success",
        "data": {
            "token": token,
            "user_id": user.id,
            "openid": openid, # Return openid for frontend display
            "nickname": user.nick,
            "avatar_url": user.avatar,
            "balance": curr_balance
        }
    }

@router.post("/candypixel/api/auth/verify-token")
def verify_auth_token(req: TokenVerifyRequest, db: Session = Depends(get_db)):
    payload = decode_token(req.token)
    if not payload:
        return {"code": 401, "message": "Invalid Token", "data": {"valid": False}}
    
    user_id = payload.get('user_id')
    user = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    if not user:
        return {"code": 401, "message": "User Not Found", "data": {"valid": False}}
    
    return {
        "code": 200, 
        "data": {
            "valid": True,
            "user_id": user.id,
            "nickname": user.nick
        }
    }

@router.get("/candypixel/api/user/balance")
def get_balance(request: Request, db: Session = Depends(get_db)):
    auth = request.headers.get("Authorization")
    if not auth:
        raise HTTPException(status_code=401, detail="Missing Token")
    
    token = auth.split(" ")[1]
    payload = decode_token(token)
    if not payload:
         raise HTTPException(status_code=401, detail="Invalid Token")
    
    user_id = payload['user_id']
    rec = db.query(UserBalance).filter(UserBalance.user_id == user_id).first()
    
    # Get project counts by type
    project_counts = {
        "total": 0,
        "creation": 0,
        "template": 0,
        "editing": 0
    }
    
    try:
        # Count all projects
        project_counts["total"] = db.query(UserProject).filter(UserProject.user_id == user_id).count()
        
        # Count by type
        project_counts["creation"] = db.query(UserProject).filter(UserProject.user_id == user_id, UserProject.type == 'CREATION').count()
        project_counts["template"] = db.query(UserProject).filter(UserProject.user_id == user_id, UserProject.type == 'TEMPLATE').count()
        project_counts["editing"] = db.query(UserProject).filter(UserProject.user_id == user_id, UserProject.type == 'EDITING').count()
    except Exception as e:
        print(f"Error counting projects: {e}")
    
    return {
        "code": 200,
        "data": {
            "balance": rec.balance if rec else 0,
            "total_recharge": rec.total_recharge if rec else 0,
            "total_consume": rec.total_consume if rec else 0,
            "project_counts": project_counts
        }
    }

@router.post("/candypixel/api/user/balance/deduct")
def deduct_balance(req: DeductRequest, request: Request, db: Session = Depends(get_db)):
    auth = request.headers.get("Authorization")
    if not auth:
         raise HTTPException(status_code=401, detail="Missing Token")
    token = auth.split(" ")[1]
    payload = decode_token(token)
    if not payload:
         raise HTTPException(status_code=401, detail="Invalid Token")
         
    user_id = payload['user_id']
    
    success, msg_or_bal = deduct_balance_internal(user_id, req.amount, req.reason, req.project_id, db)
    
    if not success:
        return {"code": 402, "message": msg_or_bal}
    
    return {
        "code": 200,
        "message": "Deducted successfully",
        "data": {"current_balance": msg_or_bal}
    }

@router.get("/candypixel/api/user/transactions")
def get_transactions(request: Request, page: int = 1, page_size: int = 20, type: str | None = None, db: Session = Depends(get_db)):
    auth = request.headers.get("Authorization")
    if not auth:
         raise HTTPException(status_code=401, detail="Missing Token")
    token = auth.split(" ")[1]
    payload = decode_token(token)
    if not payload:
         raise HTTPException(status_code=401, detail="Invalid Token")
         
    user_id = payload['user_id']
    
    offset = (page - 1) * page_size
    q = db.query(UserTransaction).filter(UserTransaction.user_id == user_id)
    
    print(f"[DEBUG] get_transactions type param: '{type}'")
    if type:
        print(f"[DEBUG] Filtering transactions by type: '{type}'")
        # Map frontend type to DB type if necessary
        db_type = type.upper() if type else None
        if db_type in ['RECHARGE', 'CONSUME']:
             q = q.filter(UserTransaction.type == db_type)
        else:
             q = q.filter(UserTransaction.type == type)
        
    logs = q.order_by(UserTransaction.created_at.desc()).offset(offset).limit(page_size).all()
    count = q.count()
    
    return {
        "code": 200,
        "data": {
            "list": [l.to_dict() for l in logs],
            "total": count,
            "page": page,
            "page_size": page_size
        }
    }

@router.get("/candypixel/api/user/projects")
def get_projects(request: Request, page: int = 1, page_size: int = 10, keyword: str | None = None, type: str | None = None, db: Session = Depends(get_db)):
    auth = request.headers.get("Authorization")
    if not auth:
         raise HTTPException(status_code=401, detail="Missing Token")
    token = auth.split(" ")[1]
    payload = decode_token(token)
    if not payload:
         raise HTTPException(status_code=401, detail="Invalid Token")
         
    user_id = payload['user_id']
    
    offset = (page - 1) * page_size
    
    # Query with join to get template name
    q = db.query(UserProject, BusinessPromptStyleTemplate.name.label('template_name'))\
          .outerjoin(BusinessPromptStyleTemplate, UserProject.template_id == BusinessPromptStyleTemplate.id)\
          .filter(UserProject.user_id == user_id)
    
    if keyword:
        # Search in prompt or project_id (assuming prompt contains useful info)
        q = q.filter(UserProject.prompt.like(f"%{keyword}%"))
    
    print(f"[DEBUG] get_projects type param: '{type}'")
    if type and type != 'ALL' and type != '':
        # Map frontend type keys to DB types
        # Frontend usually sends: 'image', 'template', 'edit'
        if type == 'image': db_type = 'CREATION'
        elif type == 'template': db_type = 'TEMPLATE'
        elif type == 'edit': db_type = 'EDITING'
        else: db_type = type.upper()
        
        print(f"[DEBUG] Filtering projects by db_type: '{db_type}'")
        q = q.filter(UserProject.type == db_type)
        
    projects_with_names = q.order_by(UserProject.created_at.desc()).offset(offset).limit(page_size).all()
    count = q.count()
    
    result_list = []
    for p, t_name in projects_with_names:
        d = p.to_dict()
        d['template_name'] = t_name
        result_list.append(d)

    return {
        "code": 200,
        "data": {
            "list": result_list,
            "total": count,
            "page": page,
            "page_size": page_size
        }
    }

@router.delete("/candypixel/api/user/projects/{project_id}")
def delete_project(project_id: str, request: Request, db: Session = Depends(get_db)):
    auth = request.headers.get("Authorization")
    if not auth:
         raise HTTPException(status_code=401, detail="Missing Token")
    token = auth.split(" ")[1]
    payload = decode_token(token)
    if not payload:
         raise HTTPException(status_code=401, detail="Invalid Token")
         
    user_id = payload['user_id']
    
    # Find project
    p = db.query(UserProject).filter(UserProject.project_id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Check ownership
    if p.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
        
    try:
        db.delete(p)
        db.commit()
        return {"code": 200, "message": "Project deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(e)}")
