from fastapi import FastAPI, HTTPException, Depends, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import json
import requests
import datetime
import time
import uuid
import logging
import hashlib
import threading

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("PixelServer")

class AICircuitOpenError(Exception):
    pass

AI_CIRCUIT_FAILURE_THRESHOLD = 5
AI_CIRCUIT_WINDOW_SECONDS = 60
AI_CIRCUIT_COOLDOWN_SECONDS = 120

_ai_circuit_states: dict[str, dict] = {}

def _ai_circuit_id(provider: str, api_key: str | None) -> str:
    if not api_key:
        return f"{provider}:none"
    key_hash = hashlib.sha256(api_key.encode("utf-8")).hexdigest()[:16]
    return f"{provider}:{key_hash}"

def _ai_circuit_state_get(circuit_id: str) -> dict:
    state = _ai_circuit_states.get(circuit_id)
    if not isinstance(state, dict):
        state = {"open_until": None, "failures": []}
        _ai_circuit_states[circuit_id] = state
    return state

def _ai_circuit_is_open(state: dict, now: datetime.datetime) -> bool:
    open_until = state.get("open_until")
    return isinstance(open_until, datetime.datetime) and now < open_until

def _ai_circuit_prune(state: dict, now: datetime.datetime):
    window_start = now - datetime.timedelta(seconds=AI_CIRCUIT_WINDOW_SECONDS)
    failures = state.get("failures") or []
    state["failures"] = [t for t in failures if isinstance(t, datetime.datetime) and t >= window_start]

def _ai_circuit_record_failure(provider: str, api_key: str | None, now: datetime.datetime):
    for circuit_id in (_ai_circuit_id(provider, api_key), _ai_circuit_id(provider, None)):
        state = _ai_circuit_state_get(circuit_id)
        _ai_circuit_prune(state, now)
        failures = state.get("failures") or []
        failures.append(now)
        state["failures"] = failures
        if len(failures) >= AI_CIRCUIT_FAILURE_THRESHOLD:
            state["open_until"] = now + datetime.timedelta(seconds=AI_CIRCUIT_COOLDOWN_SECONDS)

def _ai_circuit_record_success(provider: str, api_key: str | None):
    for circuit_id in (_ai_circuit_id(provider, api_key), _ai_circuit_id(provider, None)):
        state = _ai_circuit_state_get(circuit_id)
        state["failures"] = []
        state["open_until"] = None

def _ai_circuit_guard(provider: str, api_key: str | None = None):
    now = datetime.datetime.now()
    if _ai_circuit_is_open(_ai_circuit_state_get(_ai_circuit_id(provider, None)), now):
        raise AICircuitOpenError("AI 服务繁忙，请稍后重试")
    if _ai_circuit_is_open(_ai_circuit_state_get(_ai_circuit_id(provider, api_key)), now):
        raise AICircuitOpenError("AI 服务繁忙，请稍后重试")

def log_debug(tag, message, data=None):
    """Structured debug logging"""
    timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_msg = f"{timestamp} [{tag}] {message}"
    if data:
        # Avoid logging huge base64 strings
        clean_data = data
        if isinstance(data, dict):
            clean_data = data.copy()
            for k, v in clean_data.items():
                if isinstance(v, str) and len(v) > 500:
                    clean_data[k] = v[:50] + "..."
        elif isinstance(data, str) and len(data) > 500:
             clean_data = data[:50] + "..."
             
        log_msg += f" | Data: {json.dumps(clean_data, ensure_ascii=False)}"
    
    print(log_msg) # Print to stdout for immediate terminal visibility
    # logger.info(log_msg) # Also log to file/system if needed

from dotenv import load_dotenv

# Load env vars
try:
    _root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(os.path.join(_root, '.env.local'))
    load_dotenv(os.path.join(_root, '.env'))
    # Also try current directory (server_py/) for overrides
    load_dotenv('.env.local')
    load_dotenv('.env')
except Exception as e:
    print(f"Warning: Error loading .env files: {e}")

from sqlalchemy.orm import Session
from sqlalchemy import cast, String
# try:
#     from mysql_config import get_db, SessionLocal
#     from pixel_models import BusinessPromptStyleTemplate, UserBalance, UserProject, UserProject
#     from pixel_user_service import router as user_router, deduct_balance_internal, get_user_by_token
#     from utils.key_manager import key_manager
# except ImportError:
#     from .mysql_config import get_db, SessionLocal
#     from .pixel_models import BusinessPromptStyleTemplate, UserBalance, UserProject, UserProject
#     from .pixel_user_service import router as user_router, deduct_balance_internal, get_user_by_token
#     from .utils.key_manager import key_manager 
from mysql_config import get_db, SessionLocal
from pixel_models import BusinessPromptStyleTemplate, UserBalance, UserProject
from pixel_user_service import router as user_router, deduct_balance_internal, get_user_by_token
from utils.key_manager import key_manager    

app = FastAPI(title="Pixel AIGC Server V2", description="AIGC Service for Candy Pixel V2")

origins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3002',
    'http://127.0.0.1:3002',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    '*' # For development convenience
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*']
)

# Mount User Service
app.include_router(user_router)

# Config
ALIYUN_API_BASE = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation' 
DASHSCOPE_API_BASE = 'https://dashscope.aliyuncs.com/api/'

# Models
class TemplateGenerateRequest(BaseModel):
    template_id: int
    prompt: str | None = None
    input_images: list[str] | None = None
    user_inputs: dict[str, str] | None = None

class SuggestionRequest(BaseModel):
    template_id: int
    field_key: str
    input_value: str

class GenerateEditRequest(BaseModel):
    baseImage: str  # Base64
    maskImage: str | None = None # Base64
    refImage: str | None = None # Base64
    prompt: str | None = None
    style: str | None = None # For quick actions like "Ghibli"

class MemeGenerateRequest(BaseModel):
    scene_description: str
    style_id: str | None = 'CLASSIC' # CLASSIC, CARTOON, ANIME, PIXEL_ART, OIL_PAINTING
    input_image: str | None = None # Base64 or URL
    
# Logic

API_BASE = 'https://api-inference.modelscope.cn/'

def get_requests_session():
    """
    Returns a requests Session with retry logic.
    Max 3 retries for connection errors/status codes 500/502/503/504.
    """
    s = requests.Session()
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
    
    # Define retry strategy
    retry_strategy = Retry(
        total=3,  # Total number of retries
        backoff_factor=0.5,  # Wait 0.5s, 1s, 2s...
        status_forcelist=[500, 502, 503, 504],  # Retry on these status codes
        allowed_methods=["HEAD", "GET", "POST", "PUT", "DELETE", "OPTIONS", "TRACE"] # Retry on these methods
    )
    
    adapter = HTTPAdapter(max_retries=retry_strategy)
    s.mount("https://", adapter)
    s.mount("http://", adapter)
    return s

def optimize_prompt_with_qwen3vl(template_prompt, template_image_url, user_inputs, user_image_url=None, prompt_override=None):
    """
    Use Qwen3-VL to optimize the prompt for Qwen-Image-Edit.
    It combines Template Style (from prompt+image) and User Request (inputs).
    """
    api_key, _ = key_manager.get_random_key()  # 辅助函数不需要保存key_id
    if not api_key:
        print("Warning: No API Key for Qwen3VL optimization")
        return template_prompt # Fallback

    # Construct the instruction for Qwen3VL
    user_text_info = ", ".join([f"{k}: {v}" for k, v in (user_inputs or {}).items()])
    if prompt_override:
        user_text_info += f", Additional Instructions: {prompt_override}"
    
    system_prompt = f"""You are an expert Art Director for AI Image Generation.
    
    Goal: Write a precise English prompt for Qwen-Image-Edit-2509 to generate a new image.
    
    Input Resources:
    1. Image 1 (First Image Provided): The "Template Reference". This defines the STYLE, LIGHTING, COMPOSITION, and SCENE atmosphere.
    2. Image 2 (Second Image Provided, Optional): The "User Subject". This is the product or person that must appear in the final image.
    3. Template Description: "{template_prompt}"
    4. User Customization: "{user_text_info}"
    
    Task:
    Write a single, detailed prompt that:
    - Recreates the style/scene of Image 1.
    - Integrates the subject from Image 2 (if present) into that scene naturally.
    - Applies the User Customization text/ideas (e.g., if they asked for a specific slogan or mood).
    - If no user image is provided, generate the scene described by the Template + User Customization.
    
    The prompt should be descriptive, focusing on visual elements, lighting, texture, and composition.
    Output ONLY the prompt text. No explanations."""

    messages = [
        {'role': 'system', 'content': [{'type': 'text', 'text': system_prompt}]},
        {'role': 'user', 'content': []}
    ]
    
    # Add Template Image
    if template_image_url:
        messages[1]['content'].append({'type': 'image_url', 'image_url': {'url': template_image_url}})
    
    # Add User Image (as reference for what is being edited) - Optional, Qwen3VL can see what we are editing
    if user_image_url:
        messages[1]['content'].append({'type': 'image_url', 'image_url': {'url': user_image_url}})
        messages[1]['content'].append({'type': 'text', 'text': "This is the user's photo that will be edited."})
    
    messages[1]['content'].append({'type': 'text', 'text': "Generate the optimized prompt now."})

    body = {
        'model': 'Qwen/Qwen3-VL-8B-Instruct',
        'messages': messages,
        'stream': False
    }
    
    headers = {
        'Authorization': f"Bearer {api_key}",
        'Content-Type': 'application/json'
    }

    try:
        log_debug("AI_API", f"Calling {API_BASE}v1/chat/completions", body)
        
        # Unified Guard (Rate Limit + Circuit Breaker)
        ai_gateway.guard("modelscope", api_key)
        
        session = get_requests_session()
        r = session.post(
            f"{API_BASE}v1/chat/completions",
            headers=headers,
            data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
            timeout=60
        )
        r.raise_for_status()
        resp_json = r.json()
        log_debug("AI_API", "Qwen3VL Response", resp_json)
        optimized = resp_json['choices'][0]['message']['content'].strip()
        print(f"Qwen3VL Optimized Prompt: {optimized}")
        _ai_circuit_record_success("modelscope", api_key)
        return optimized
    except Exception as e:
        if not isinstance(e, AICircuitOpenError) and not isinstance(e, HTTPException):
            _ai_circuit_record_failure("modelscope", api_key, datetime.datetime.now())
        print(f"Qwen3VL Optimization Failed: {e}")
        return template_prompt # Fallback to default

# -----------------------------------------------------------------------------
# AI Gateway & Robustness Layer
# -----------------------------------------------------------------------------
class AIGateway:
    """
    Central gateway for all AI Service calls.
    Provides:
    1. Global Rate Limiting (System Protection)
    2. Circuit Breaker Integration
    3. Unified Logging
    """
    _instance = None
    
    def __init__(self):
        self.last_call_time = 0
        self.call_count = 0
        self.window_start = time.time()
        # Rate Limit: 60 requests per minute (Adjust based on your Aliyun quota)
        self.RATE_LIMIT = int(os.getenv("AI_GLOBAL_RATE_LIMIT", "60")) 
        self.lock = False # Not used, we use threading.Lock below
        self._thread_lock = threading.Lock() # Ensure thread safety

    @classmethod
    def get_instance(cls):
        if not cls._instance:
            cls._instance = cls()
        return cls._instance

    def check_traffic(self):
        """
        Enforce global rate limit (Thread-Safe)
        """
        with self._thread_lock:
            now = time.time()
            # Reset window every minute
            if now - self.window_start > 60:
                self.window_start = now
                self.call_count = 0
                
            if self.call_count >= self.RATE_LIMIT:
                log_debug("AI_GATEWAY", f"Global Rate Limit Exceeded: {self.call_count}/{self.RATE_LIMIT}")
                raise HTTPException(status_code=429, detail="System AI Service Busy (Rate Limit)")
                
            self.call_count += 1
        return True

    def guard(self, provider, api_key):
        """
        Combine Rate Limit + Circuit Breaker
        """
        self.check_traffic()
        _ai_circuit_guard(provider, api_key)

ai_gateway = AIGateway.get_instance()

def submit_to_aliyun(api_key, prompt, style_config=None):
    """
    Real submission to Aliyun (ModelScope) Z-Image-Turbo
    错误直接抛出，不进行容错处理
    """
    log_debug("AI_API", "Preparing Z-Image-Turbo Task", {"prompt": prompt, "key": api_key[:12] + '...' if api_key else 'None'})
    
    if not api_key:
        raise HTTPException(status_code=500, detail="No API Key available")
    
    headers = {
        'Authorization': f"Bearer {api_key}",
        'Content-Type': 'application/json',
        'X-ModelScope-Async-Mode': 'true'
    }
    
    body = {
        'model': 'Tongyi-MAI/Z-Image-Turbo', 
        'prompt': prompt
    }
    
    log_debug("AI_API", f"Calling {API_BASE}v1/images/generations", body)
    
    # Unified Guard (Rate Limit + Circuit Breaker)
    ai_gateway.guard("modelscope", api_key)
    
    session = get_requests_session()
    r = session.post(
        f"{API_BASE}v1/images/generations", 
        headers=headers, 
        data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
        timeout=10
    )
    
    resp_json = r.json()
    log_debug("AI_API", "Response Received", resp_json)
    
    if r.status_code != 200:
        _ai_circuit_record_failure("modelscope", api_key, datetime.datetime.now())
        log_debug("AI_API", "Request Failed", {"status": r.status_code, "text": r.text})
        raise HTTPException(status_code=r.status_code, detail=f"AI API Error: {r.text}")
    
    _ai_circuit_record_success("modelscope", api_key)
    return resp_json['task_id']

def check_aliyun_status(api_key, task_id):
    """
    Check status of Aliyun Task
    """
    headers = {
        'Authorization': f"Bearer {api_key}",
        'Content-Type': 'application/json',
        'X-ModelScope-Task-Type': 'image_generation'
    }
    
    # print(f"Checking Aliyun Task: ID={task_id}") # Reduce spam
    
    try:
        try:
            # We use the same guard, but maybe with a higher limit for reads?
            # For simplicity, we skip rate limiting for READ operations to avoid blocking status checks,
            # BUT we still respect Circuit Breaker.
            _ai_circuit_guard("modelscope", api_key)
        except AICircuitOpenError as e:
            return "PENDING", None, str(e)

        session = get_requests_session()
        r = session.get(f"{API_BASE}v1/tasks/{task_id}", headers=headers, timeout=60)
        
        if r.status_code != 200:
            log_debug("AI_API", "Check Status Error", {"code": r.status_code, "text": r.text})
            if r.status_code in (401, 403, 429) or r.status_code >= 500:
                _ai_circuit_record_failure("modelscope", api_key, datetime.datetime.now())
            # If status check fails with HTTP error, we should probably return PENDING to retry later,
            # unless it's 404 (task not found) or 401/403 (auth error).
            # But the Retry strategy above handles 5xx. 
            # If we are here, it's either 4xx or retries exhausted (which raises Exception).
            if r.status_code == 404:
                return "FAILED", None, "Task Not Found"
            return "PENDING", None, f"HTTP {r.status_code}"
            
        res = r.json()
        _ai_circuit_record_success("modelscope", api_key)

        log_debug("AI_API", "Task Status Response", res)
        task_status = res.get('task_status') # SUCCEEDED, FAILED, RUNNING, PENDING
        print(f"Aliyun Status: {task_status}")
        
        if task_status in ['SUCCEED', 'SUCCEEDED']:
            # Extract images. Structure differs by model.
            results = []
            
            # 1. Structure from User's Reference (Z-Image-Turbo)
            if 'output_images' in res:
                results.extend(res['output_images'])
                
            # 2. Key "results" in output (Common ModelScope)
            elif 'output' in res and 'results' in res['output']:
                for item in res['output']['results']:
                    if 'url' in item:
                        results.append(item['url'])
                    elif 'image' in item: 
                         results.append(item['image'])
            
            # 3. Fallback check (output.url)
            elif 'output' in res and 'url' in res['output']:
                 results.append(res['output']['url'])

            print(f"Aliyun Success Results: {results}")
            return "SUCCEEDED", results, None
            
        elif task_status == 'FAILED':
            print(f"Aliyun Task Failed: {res}")
            # Try to extract error detail
            detail = res.get('error_msg') or res.get('message') or json.dumps(res)[:500]
            return "FAILED", None, detail
        else:
            return "PENDING", None, None # RUNNING -> PENDING
            
    except Exception as e:
        print(f"Aliyun Check Error: {e}")
        if not isinstance(e, AICircuitOpenError):
            _ai_circuit_record_failure("modelscope", api_key, datetime.datetime.now())
        # If requests retry failed (SSLError, MaxRetryError), we should stop polling to avoid infinite loops
        # User requested max 3 retries then fail. Requests session already handles 3 retries.
        if "SSLError" in str(e) or "Max retries exceeded" in str(e):
             return "FAILED", None, f"Network Error: {str(e)}"
        return "PENDING", None, str(e) # Retry later for other errors

@app.get("/candypixel/api/templates")
def list_templates(
    category: str | None = None, 
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
    lite: int | None = None, 
    db: Session = Depends(get_db)
):
    q = db.query(BusinessPromptStyleTemplate).filter(BusinessPromptStyleTemplate.status == 'active')
    
    if category and category != 'all':
        q = q.filter(BusinessPromptStyleTemplate.category == category)
        
    if search:
        search_term = f"%{search}%"
        # Search on name, description, and tags (casted to string)
        q = q.filter(
            (BusinessPromptStyleTemplate.name.like(search_term)) | 
            (BusinessPromptStyleTemplate.description.like(search_term)) |
            (cast(BusinessPromptStyleTemplate.tags, String).like(search_term))
        )
    
    # Pagination
    total = q.count()
    templates = q.order_by(BusinessPromptStyleTemplate.sort_order.desc())\
                 .offset((page - 1) * page_size)\
                 .limit(page_size)\
                 .all()
    
    # Convert to dict and add base64 covers
    result = []
    from urllib.parse import urlparse
    host_env = os.getenv('OSS_PUBLIC_HOST', '').strip()
    allowed_hosts = set()
    if host_env:
        try:
            allowed_hosts.add(urlparse(host_env).netloc)
        except Exception:
            pass
    # Always allow Unsplash as fallback source for previews
    allowed_hosts.update({"images.unsplash.com"})
    convert_limit = 12
    converted = 0
    for t in templates:
        d = t.to_dict()
        # Fast path: lite mode skips base64 conversion to reduce latency
        if not lite:
            # Try to convert cover to base64 for WeChat display (safe hosts only) with cap
            if converted < convert_limit and t.cover_image and t.cover_image.startswith('http'):
                domain_ok = True
                try:
                    netloc = urlparse(t.cover_image).netloc
                    domain_ok = (netloc in allowed_hosts) or (not allowed_hosts)
                except Exception:
                    domain_ok = False
                if domain_ok:
                    b64_data = download_and_convert_to_base64(t.cover_image)
                    if b64_data:
                        d['cover_image_base64'] = b64_data
                        d['image_url_base64'] = b64_data
                        converted += 1
        result.append(d)
    
    return {
        "code": 200, 
        "data": result,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size
        }
    }

@app.get("/candypixel/api/templates/{tid}")
def get_template(tid: int, db: Session = Depends(get_db)):
    t = db.query(BusinessPromptStyleTemplate).get(tid)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"code": 200, "data": t.to_dict()}

def process_template_generation_task(project_id, user_inputs, prompt_override, input_images_raw, template_id):
    log_debug("TASK", f"Starting Background Task for Project {project_id}", {
        "user_inputs": user_inputs,
        "prompt_override": prompt_override,
        "template_id": template_id
    })
    
    db = SessionLocal()
    try:
        # Get Template
        tpl = db.query(BusinessPromptStyleTemplate).get(template_id)
        if not tpl:
            log_debug("TASK", f"Task Failed: Template {template_id} not found")
            return

        # 1. Upload input images to OSS
        oss_urls = []
        if input_images_raw:
            for img in input_images_raw:
                url = ensure_public_url(img)
                if url:
                    oss_urls.append(url)
            log_debug("TASK", "Uploaded Input Images to OSS", oss_urls)
        
        # 2. Prompt Assembly & Optimization
        # default_prompt here acts as the "Style/Scene Description" for the VL model
        style_desc = tpl.default_prompt or "High quality, professional studio lighting"
        
        # Optimize if we have images/inputs
        # We ALWAYS use the template cover as the style reference
        tpl_img_url = tpl.cover_image
        user_img_url = oss_urls[0] if oss_urls else None
        
        # Prepare inputs for Qwen3-VL
        # logic: Template Image (Style) + User Image (Subject) + User Text -> Optimized Prompt
        
        # [2025-12-22] 优化: 如果用户提供了自定义提示词 (prompt_override)，则跳过 Qwen3VL 优化
        # 直接使用用户的提示词，避免 Qwen3VL 添加多余的解释或错误的指令
        if prompt_override:
            log_debug("TASK", "Using User Prompt Override (Skipping Qwen3VL)", prompt_override)
            final_prompt = prompt_override
        else:
            log_debug("TASK", f"Optimizing prompt for Template: {tpl.name}")
            final_prompt = optimize_prompt_with_qwen3vl(
                 template_prompt=style_desc,
                 template_image_url=tpl_img_url,
                 user_inputs=user_inputs,
                 user_image_url=user_img_url,
                 prompt_override=prompt_override
            )
        
        log_debug("TASK", "Final Prompt Ready", {"final_prompt": final_prompt})

        # 3. Submit Task - 获取随机KEY和KEY ID
        key, key_id = key_manager.get_random_key()
        log_debug("TASK", f"Selected API Key ID: {key_id} for Project {project_id}")
        if not key:
            log_debug("TASK", "No API Key available")
            p = db.query(UserProject).filter(UserProject.project_id == project_id).first()
            if p:
                p.status = 'FAILED'
                p.error_msg = "No API Key available"
                db.commit()
            return
        
        aliyun_task_id = None
        
        # Construct Image List for Qwen-Image-Edit-2509
        # Order matters: [Template/Background, User/Subject]
        # We want to apply the template's style/scene to the user's content, 
        # OR put the user's content into the template's scene.
        generation_images = []
        
        # Always include template image (as style/base)
        if tpl_img_url:
             # Ensure it's a public URL (though template covers usually are)
             generation_images.append(ensure_public_url(tpl_img_url))
             
        # Add user images
        if oss_urls:
             generation_images.extend(oss_urls)
             
        # Call Qwen-Image-Edit-2509
        if generation_images:
            aliyun_task_id = create_qwen_edit_task(key, final_prompt, generation_images)
        else:
            # Fallback (Shouldn't happen for templates usually)
            aliyun_task_id = submit_to_aliyun(key, final_prompt)
        
        if not aliyun_task_id:
            log_debug("TASK", "Submission to AI Provider failed")
            p = db.query(UserProject).filter(UserProject.project_id == project_id).first()
            if p:
                p.status = 'FAILED'
                p.error_msg = "Submission to AI Provider failed"
                db.commit()
            return

        # 4. Update Project - 保存 key_id 用于状态轮询
        p = db.query(UserProject).filter(UserProject.project_id == project_id).first()
        if p:
            p.status = 'PROCESSING'
            p.prompt = final_prompt
            p.input_images = {
                "provider": "aliyun",
                "aliyun_task_id": aliyun_task_id,
                "api_key_id": key_id,  # 保存KEY ID用于状态轮询
                "original_inputs": oss_urls,
                "attempt_count": 1,
                "retry_count": 0
            }
            db.commit()
            log_debug("TASK", f"Task Submitted Successfully: {aliyun_task_id}")
            
    except Exception as e:
        log_debug("TASK", f"Background Task Error: {e}")
        try:
            p = db.query(UserProject).filter(UserProject.project_id == project_id).first()
            if p:
                p.status = 'FAILED'
                p.error_msg = str(e)
                db.commit()
        except:
            pass
    finally:
        db.close()

def process_meme_generation_task(project_id, scene_description, style_id, input_image_raw):
    log_debug("MEME_TASK", f"Starting Meme Task for Project {project_id}", {
        "scene": scene_description,
        "style": style_id,
        "has_image": bool(input_image_raw)
    })
    
    db = SessionLocal()
    try:
        # Styles Config
        STYLES = {
            'CLASSIC': 'photorealistic, high quality photography, cinematic lighting, meme style',
            'CARTOON': 'cartoon style, vibrant colors, comic book art, expressive 2d animation',
            'ANIME': 'anime style, studio ghibli inspired, high detail, cel shaded',
            'PIXEL_ART': 'pixel art, 16-bit retro game style, dithering',
            'OIL_PAINTING': 'classical oil painting, textured brushstrokes, museum quality'
        }
        style_suffix = STYLES.get(style_id, STYLES['CLASSIC'])

        # 1. Upload User Image if exists
        user_img_url = None
        if input_image_raw:
            user_img_url = ensure_public_url(input_image_raw)
            log_debug("MEME_TASK", "Uploaded User Image", user_img_url)

        # 2. Call "The Brain" (Qwen) for Text & Visual Description
        api_key, key_id = key_manager.get_random_key()
        log_debug("MEME_TASK", f"Selected API Key ID: {key_id} for Project {project_id}")
        if not api_key:
             raise Exception("No API Key available")

        system_prompt = f"""You are a professional meme creator. The user wants a meme about: "{scene_description}".
Tasks:
1. Create a funny, punchy "Top Text" and "Bottom Text" in **Simplified Chinese**.
2. Write a detailed "Visual Description" of the image that should be generated. **The visual description MUST be in English** (this is critical for the image generator). It should be purely visual (what is happening, who is there, expressions), do not describe the text overlay.
Output JSON format: {{"top": "text", "bottom": "text", "visual": "english description"}}"""
        
        # If user provided image, tell AI to focus on text only (Visual description is less critical but still good to have for consistency)
        if user_img_url:
             system_prompt += "\nNote: The user provided an image, so the visual description will be ignored for generation, but please still generate it for context."

        log_debug("MEME_TASK", "Calling Qwen for Idea", {"system": system_prompt})
        
        # Use Qwen-Turbo/Plus or Qwen3-8B 
        # Using standard chat completion
        headers = {
            'Authorization': f"Bearer {api_key}",
            'Content-Type': 'application/json'
        }
        body = {
            'model': 'Qwen/Qwen2.5-72B-Instruct', # Use a smart model for humor
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': "Generate now."}
            ],
            'response_format': {'type': 'json_object'} # Force JSON
        }

        try:
            # Unified Guard (Rate Limit + Circuit Breaker)
            ai_gateway.guard("modelscope", api_key)
            
            session = get_requests_session()
            r = session.post(
                f"{API_BASE}v1/chat/completions",
                headers=headers,
                data=json.dumps(body).encode('utf-8'),
                timeout=30
            )
            r.raise_for_status()
            _ai_circuit_record_success("modelscope", api_key)
        except Exception as e:
            if not isinstance(e, AICircuitOpenError) and not isinstance(e, HTTPException):
                _ai_circuit_record_failure("modelscope", api_key, datetime.datetime.now())
            raise

        res_json = r.json()
        content = res_json['choices'][0]['message']['content']
        log_debug("MEME_TASK", "Qwen Idea Response", content)
        
        try:
            idea = json.loads(content)
        except:
             # Fallback parsing
             import re
             match = re.search(r'\{.*\}', content, re.DOTALL)
             if match:
                 idea = json.loads(match.group())
             else:
                 raise Exception("Failed to parse JSON from AI")

        # 3. Image Generation (The Hand) - ONLY if no user image
        final_image_url = user_img_url
        aliyun_task_id = None
        
        if not user_img_url:
            visual_desc = idea.get('visual', scene_description)
            full_prompt = f"{visual_desc}. {style_suffix}. High resolution, expressive faces, funny composition, no text overlays in the image itself."
            
            # Submitting to Z-Image-Turbo (via submit_to_aliyun helper)
            # submit_to_aliyun returns task_id
            aliyun_task_id = submit_to_aliyun(api_key, full_prompt)
            log_debug("MEME_TASK", "Submitted Image Gen Task", aliyun_task_id)

            # Wait for result here? Or let the poller handle it?
            # Existing logic in `process_template_generation_task` waits??? 
            # NO, `process_template_generation_task` submits and updates DB with task_id.
            # The client polls `check_aliyun_status` via `GET /projects/{pid}`?
            # Wait, `process_template_generation_task` ENDS after submission.
            # But where is the polling logic?
            # Ah, looking at `pixel_aigc_server.py`, there is NO automatic polling background task.
            # The CLIENT (Frontend) polls `/candypixel/api/projects/{pid}`.
            # And `get_project` (which I need to verify) likely checks status if it's PROCESSING.
            # Let's check `get_project` implementation later. 
            # For now, I will follow the pattern: Submit Task -> Update DB -> Frontend Polls.
        
        # 4. Update Project
        p = db.query(UserProject).filter(UserProject.project_id == project_id).first()
        if p:
            # Store the text idea in 'prompt' field as JSON string for frontend to use
            text_payload = json.dumps({
                "top": idea.get('top', ''),
                "bottom": idea.get('bottom', ''),
                "visual": idea.get('visual', '')
            }, ensure_ascii=False)
            
            p.prompt = text_payload
            
            if aliyun_task_id:
                p.status = 'PROCESSING'
                p.input_images = {
                    "provider": "aliyun",
                    "aliyun_task_id": aliyun_task_id,
                    "api_key_id": key_id,  # 保存KEY ID用于状态轮询
                    "mode": "ai-gen",
                    "attempt_count": 1,
                    "retry_count": 0
                }
            else:
                # Text Only / User Image Mode -> Immediate Success
                p.status = 'SUCCESS'
                p.result_images = [user_img_url] # It's a list
                p.input_images = {
                    "mode": "user-upload",
                    "original": user_img_url
                }
                
            db.commit()
            log_debug("MEME_TASK", "Task Updated Successfully", p.status)

    except Exception as e:
        log_debug("MEME_TASK", f"Task Failed: {e}")
        try:
            p = db.query(UserProject).filter(UserProject.project_id == project_id).first()
            if p:
                p.status = 'FAILED'
                p.error_msg = str(e)
                db.commit()
        except:
            pass
    finally:
        db.close()

@app.post("/candypixel/api/generate/suggestion")
def generate_suggestion(req: SuggestionRequest, request: Request, db: Session = Depends(get_db)):
    log_debug("API", "Received Suggestion Request", req.dict())

    # 1. Auth
    auth = request.headers.get('Authorization')
    if not auth:
        raise HTTPException(status_code=401, detail="Missing Token")
    token = auth.split(' ')[1]
    user = get_user_by_token(token, db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid Token")
    
    # 2. Get Template & Config
    tpl = db.query(BusinessPromptStyleTemplate).get(req.template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
        
    config = tpl.user_input_config
    if not config or 'text_inputs' not in config:
        raise HTTPException(status_code=400, detail="Template config invalid")
        
    # 3. Find target field config
    target_field = None
    for f in config['text_inputs']:
        if f['key'] == req.field_key:
            target_field = f
            break
            
    if not target_field or 'ai_suggestion' not in target_field:
        raise HTTPException(status_code=400, detail="AI suggestion not configured for this field")
        
    ai_conf = target_field['ai_suggestion']
    if not ai_conf.get('enabled'):
        raise HTTPException(status_code=400, detail="AI suggestion disabled")
        
    # 4. Generate Prompt
    prompt_template = ai_conf.get('prompt_template', '')
    final_prompt = prompt_template.replace('{input}', req.input_value)
    log_debug("AI_API", "Generated Suggestion Prompt", {"final_prompt": final_prompt})
    
    # 5. Call Qwen (Using optimize_prompt_with_qwen3vl logic but simpler)
    # We can reuse the Qwen3VL or just Qwen-Turbo (Text only). 
    # optimize_prompt_with_qwen3vl uses Qwen3-VL-8B-Instruct. Let's stick to it or Qwen-Turbo.
    # Text-only generation is cheaper/faster with Qwen-Turbo.
    
    api_key, _ = key_manager.get_random_key()  # 辅助函数不需要保存key_id
    if not api_key:
        log_debug("API", "Error: No API Key available")
        raise HTTPException(status_code=500, detail="Server Config Error: No API Key")

    headers = {
        'Authorization': f"Bearer {api_key}",
        'Content-Type': 'application/json'
    }
    
    # Using Qwen/Qwen3-8B for pure text generation
    body = {
        'model': 'Qwen/Qwen3-8B',
        'messages': [
            {'role': 'system', 'content': 'You are a creative copywriter assistant.'},
            {'role': 'user', 'content': final_prompt}
        ],
        'stream': False,
        'enable_thinking': False
    }
    
    log_debug("AI_API", f"Calling {API_BASE}v1/chat/completions", body)

    try:
        # Unified Guard (Rate Limit + Circuit Breaker)
        ai_gateway.guard("modelscope", api_key)
        
        # Use ModelScope Inference API (API_BASE)
        r = requests.post(
            f"{API_BASE}v1/chat/completions", 
            headers=headers,
            data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
            timeout=30
        )
        
        if r.status_code != 200:
             log_debug("AI_API", f"ModelScope API Failed: {r.status_code}", r.text)
             _ai_circuit_record_failure("modelscope", api_key, datetime.datetime.now())
             raise HTTPException(status_code=r.status_code, detail=f"Provider Error: {r.text}")
        
        res = r.json()
        log_debug("AI_API", "Suggestion Response", res)
        _ai_circuit_record_success("modelscope", api_key)
        
        suggestion = res['choices'][0]['message']['content'].strip()
        # Clean up quotes if any
        if suggestion.startswith('"') and suggestion.endswith('"'):
            suggestion = suggestion[1:-1]
            
        return {"code": 200, "data": {"suggestion": suggestion}}
        
    except Exception as e:
        if not isinstance(e, AICircuitOpenError) and not isinstance(e, HTTPException):
            _ai_circuit_record_failure("modelscope", api_key, datetime.datetime.now())
        log_debug("AI_API", "Suggestion Generation Failed", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/candypixel/api/generate/template")
def generate_template(req: TemplateGenerateRequest, request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    log_debug("API", "Received Template Generation Request", req.dict())
    
    # 1. Auth
    auth = request.headers.get('Authorization')
    if not auth:
        raise HTTPException(status_code=401, detail="Missing Token")
    token = auth.split(' ')[1]
    
    user = get_user_by_token(token, db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid Token")
    
    # Check Daily Limit
    check_daily_limit(db, user.id)
    
    # 2. Get Template
    tpl = db.query(BusinessPromptStyleTemplate).get(req.template_id)
    if not tpl:
         raise HTTPException(status_code=404, detail="Template not found")

    # 3. Check Balance (不扣分，成功后才扣)
    balance_rec = db.query(UserBalance).filter(UserBalance.user_id == user.id).first()
    if not balance_rec or balance_rec.balance < tpl.points_cost:
        return {"code": 402, "message": "积分不足"}

    # 4. Project ID
    project_id = f"P{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"
    log_debug("API", f"Created Project ID: {project_id}")
    
    # 5. Create Project Record (Queued)
    project = UserProject(
        project_id=project_id,
        user_id=user.id,
        type='TEMPLATE',
        status='QUEUED', 
        prompt=req.prompt, # Initial prompt, will be updated
        template_id=tpl.id,
        cost_points=tpl.points_cost,
        input_images={} 
    )
    db.add(project)
    db.commit()
    
    # 6. Schedule Background Task
    background_tasks.add_task(
        process_template_generation_task,
        project_id=project_id,
        user_inputs=req.user_inputs,
        prompt_override=req.prompt,
        input_images_raw=req.input_images,
        template_id=tpl.id
    )
    
    res = {
        "code": 200,
        "data": {
            "project_id": project_id,
            "status": "QUEUED",
            "eta": 30
        }
    }
    log_debug("API", "Template Generation Response", res)
    return res

@app.post("/candypixel/api/meme-gen")
def generate_meme(req: MemeGenerateRequest, request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    log_debug("API", "Received Meme Request", req.dict())
    
    # 1. Auth (Copy-paste standard auth)
    auth = request.headers.get('Authorization')
    if not auth:
        raise HTTPException(status_code=401, detail="Missing Token")
    token = auth.split(' ')[1]
    user = get_user_by_token(token, db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid Token")
        
    # Check Daily Limit
    check_daily_limit(db, user.id)
        
    # 2. Check Balance
    COST = 1
    balance_rec = db.query(UserBalance).filter(UserBalance.user_id == user.id).first()
    if not balance_rec or balance_rec.balance < COST:
        return {"code": 402, "message": "积分不足"}

    # 3. Create Project
    project_id = f"M{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"
    
    # Template ID 113 is reused for "Meme Generator" as per user request to map to existing logic if possible
    # But this is a custom endpoint. We can still store template_id=113 for tracking.
    MEME_TEMPLATE_ID = 113 
    
    project = UserProject(
        project_id=project_id,
        user_id=user.id,
        type='CREATION', # Changed from TEMPLATE to CREATION to match api_generate pattern and avoid double deduction
        status='QUEUED',
        prompt=req.scene_description, # Will be overwritten with JSON later
        template_id=MEME_TEMPLATE_ID,
        cost_points=COST,
        input_images={}
    )
    db.add(project)
    
    # Deduct Balance Upfront (Reference: api_generate)
    deduct_balance_internal(user.id, COST, "梗图生成", project_id, db)
    db.commit()
    
    # 4. Background Task
    background_tasks.add_task(
        process_meme_generation_task,
        project_id=project_id,
        scene_description=req.scene_description,
        style_id=req.style_id,
        input_image_raw=req.input_image
    )

    return {
        "code": 200,
        "data": {
            "project_id": project_id,
            "status": "QUEUED",
            "eta": 15
        }
    }

import oss2
import base64
import time

# ... existing imports ...

# Models for Generate/Edit
class GenerateRequest(BaseModel):
    prompt: str
    style: str | None = None
    aspectRatio: str | None = None
    negativePrompt: str | None = None
    additionalImages: list[str] | None = None
    source: str | None = None
    # Add template_id optional for compatibility if unified? 
    # The dedicated /generate endpoint might not use template_id logic directly or uses a default.

def check_daily_limit(db: Session, user_id: int, limit: int | None = None):
    try:
        limit = int(os.getenv("DAILY_REQUEST_LIMIT", "100"))
    except Exception:
        limit = 50
    today = datetime.datetime.now().date()
    start_of_day = datetime.datetime.combine(today, datetime.time.min)
    count = db.query(UserProject).filter(
        UserProject.user_id == user_id,
        UserProject.created_at >= start_of_day
    ).count()
    
    if count >= limit:
        log_debug("LIMIT", f"User {user_id} reached daily limit: {count}/{limit}")
        raise HTTPException(status_code=429, detail=f"Daily request limit reached ({count}/{limit})")

class EditRequest(BaseModel):
    op: str
    prompt: str | None = None
    strength: float | None = None
    aspectRatio: str | None = None
    baseImage: str
    mask: str | None = None
    additionalImages: list[str] | None = None

# OSS Helper
def get_oss_bucket():
    ak = os.getenv('OSS_ACCESS_KEY_ID')
    sk = os.getenv('OSS_ACCESS_KEY_SECRET')
    endpoint = os.getenv('OSS_ENDPOINT', 'oss-cn-shanghai.aliyuncs.com')
    bucket_name = os.getenv('OSS_BUCKET_NAME', 'longyan-sh')
    if not ak or not sk:
        return None
    auth = oss2.Auth(ak, sk)
    return oss2.Bucket(auth, endpoint, bucket_name)

def upload_base64_to_oss(b64_data):
    try:
        bucket = get_oss_bucket()
        if not bucket: 
            return None
            
        if ',' in b64_data:
            header, data = b64_data.split(',', 1)
        else:
            data = b64_data
            
        # Guess extension
        ext = 'jpg'
        if 'png' in b64_data[:20]: ext = 'png'
        
        file_name = f"candypixel/uploads/{datetime.datetime.now().strftime('%Y%m%d')}/{uuid.uuid4().hex}.{ext}"
        # Set public-read ACL so external services (like Qwen) can access the image
        bucket.put_object(file_name, base64.b64decode(data), headers={'x-oss-object-acl': 'public-read'})
        
        # Public URL
        host = os.getenv('OSS_PUBLIC_HOST', f'https://{bucket.bucket_name}.{bucket.endpoint}')
        return f"{host.rstrip('/')}/{file_name}"
    except Exception as e:
        print(f"OSS Upload Failed: {e}")
        return None

def ensure_public_url(src):
    if src.startswith('http'): return src
    return upload_base64_to_oss(src) or src

# Aliyun Qwen
def create_qwen_edit_task(api_key, prompt, image_urls):
    """
    Create Qwen-Image-Edit task
    错误直接抛出，不进行容错处理
    """
    log_debug("AI_API", "Preparing Qwen-Image-Edit Task", {"prompt": prompt, "image_urls": image_urls, "key": api_key[:12] + '...' if api_key else 'None'})
    
    if not api_key:
        raise HTTPException(status_code=500, detail="No API Key available")
    
    headers = {
        'Authorization': f"Bearer {api_key}",
        'Content-Type': 'application/json',
        'X-ModelScope-Async-Mode': 'true'
    }
    
    # Ensure image_url is a list for Qwen-Image-Edit-2509
    input_images = image_urls
    if isinstance(image_urls, str):
        input_images = [image_urls]
    
    if not input_images:
        raise HTTPException(status_code=400, detail="No input image for Qwen-Image-Edit")

    # Flat structure as per documentation/example
    body = {
        'model': 'Qwen/Qwen-Image-Edit-2509',
        'prompt': prompt,
        'image_url': input_images
    }
    
    log_debug("AI_API", f"Calling {API_BASE}v1/images/generations", body)

    # Unified Guard (Rate Limit + Circuit Breaker)
    ai_gateway.guard("modelscope", api_key)
    
    session = get_requests_session()
    r = session.post(
        f"{API_BASE}v1/images/generations", 
        headers=headers, 
        data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
        timeout=30
    )

    resp_json = r.json()
    log_debug("AI_API", "Response Received", resp_json)
    
    if r.status_code != 200:
        _ai_circuit_record_failure("modelscope", api_key, datetime.datetime.now())
        log_debug("AI_API", "Request Failed", {"status": r.status_code, "text": r.text})
        raise HTTPException(status_code=r.status_code, detail=f"AI API Error: {r.text}")
    
    _ai_circuit_record_success("modelscope", api_key)
    return resp_json['task_id']

# Endpoints

@app.post("/candypixel/api/generate")
def api_generate(req: GenerateRequest, request: Request, db: Session = Depends(get_db)):
    log_debug("API", "Received Generate Request", req.dict())

    # 1. Auth
    auth = request.headers.get('Authorization')
    if not auth: raise HTTPException(status_code=401, detail="Missing Token")
    token = auth.split(' ')[1]
    user = get_user_by_token(token, db)
    if not user: raise HTTPException(status_code=401, detail="Invalid Token")

    check_daily_limit(db, user.id)
    
    # 2. Prepare Prompt
    final_prompt = req.prompt
    if req.style: final_prompt += f", 风格: {req.style}"
    if req.aspectRatio: final_prompt += f", 比例: {req.aspectRatio}"
    
    # 2.5 Check Balance & Determine Type/Cost
    project_type = 'CREATION'
    cost = 1
    reason_note = "灵感创作"

    if req.source == 'snap':
        project_type = 'SNAP'
        cost = 3
        reason_note = "拍拍生图"

    balance_rec = db.query(UserBalance).filter(UserBalance.user_id == user.id).first()
    if not balance_rec or balance_rec.balance < cost:
        raise HTTPException(status_code=402, detail="积分不足")

    # 获取随机KEY和KEY ID，用于后续状态轮询时复用相同KEY
    key, key_id = key_manager.get_random_key()
    if not key:
        raise HTTPException(status_code=500, detail="No API Key available")
    
    # 3. Choose Model Routing Logic
    # STRATEGY: 
    # - If additionalImages provided -> Use Qwen-Image-Edit (Image Variation/Ref)
    # - If source='snap' (usually implies image) -> Qwen-Image-Edit
    # - Else (Text Only) -> Z-Image-Turbo (Wanx)
    
    aliyun_task_id = None
    input_imgs = []
    
    if req.additionalImages and len(req.additionalImages) > 0:
        # Image-to-Image / Editing / Reference Generation
        imgs = [ensure_public_url(img) for img in req.additionalImages]
        log_debug("API", "Routing to Qwen-Image-Edit (Image Input)", imgs)
        aliyun_task_id = create_qwen_edit_task(key, final_prompt, imgs)
        input_imgs = imgs
    else:
        # Text-to-Image
        log_debug("API", "Routing to Z-Image-Turbo (Text Only)")
        aliyun_task_id = submit_to_aliyun(key, final_prompt)
        
    if not aliyun_task_id:
        raise HTTPException(status_code=500, detail="Failed to create AI task")

    # 4. Create Project - 保存 key_id 用于状态轮询
    project_id = f"P{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"
    project = UserProject(
        project_id=project_id,
        user_id=user.id,
        type=project_type, 
        status='PROCESSING',
        prompt=final_prompt,
        template_id=None,
        cost_points=cost, 
        input_images={
            "provider": "aliyun",
            "aliyun_task_id": aliyun_task_id,
            "api_key_id": key_id,  # 保存KEY ID用于状态轮询
            "original_inputs": input_imgs,
            "attempt_count": 1,
            "retry_count": 0
        }
    )
    db.add(project)
    
    # 5. Deduct Balance
    deduct_balance_internal(user.id, cost, reason_note, project_id, db)
    
    db.commit()
    
    return {
        "code": 200,
        "data": {
            "project_id": project_id,
            "status": "PROCESSING",
            "eta": 15
        }
    }

# New Endpoint for Snap & Generate Analysis
class VisionAnalyzeRequest(BaseModel):
    image: str # Base64
    
def analyze_image_with_qwen3vl(image_url):
    """
    Use Qwen3-VL to analyze the image and provide a structured description for prompt generation.
    """
    api_key, _ = key_manager.get_random_key()  # 辅助函数不需要保存key_id
    if not api_key: return ["High quality photo, detailed."]

    import random
    import re

    system_prompt = """You are a Visual Aesthetics Master. perform a comprehensive analysis of the user's photo using the following dimensions:
    1. Subject (Identity, Gender, Pose)
    2. Expression (Emotion, Gaze)
    3. Scene/Background (Environment, Depth)
    4. Lighting (Shadows, Direction, Mood)
    5. Style (Texture, Colors)

    Based on this analysis, generate 5 DISTINCT, CREATIVE prompt concepts in Chinese.
    These 5 concepts must be constructive, diverse, and inspiring. They can explore different moods, styles, or artistic directions, BUT MUST PRESERVE the main subject's identity and expression.

    CRITICAL OUTPUT FORMAT:
    Return strictly a JSON list of 5 strings. Do not include markdown formatting (like ```json).
    Example:
    ["Prompt 1 text...", "Prompt 2 text...", "Prompt 3 text...", "Prompt 4 text...", "Prompt 5 text..."]
    """

    messages = [
        {'role': 'system', 'content': [{'type': 'text', 'text': system_prompt}]},
        {'role': 'user', 'content': [
            {'type': 'image_url', 'image_url': {'url': image_url}},
            {'type': 'text', 'text': "Analyze this image and provide 5 creative prompt suggestions in JSON list format."}
        ]}
    ]

    body = {
        'model': 'Qwen/Qwen2.5-VL-72B-Instruct', # Enhanced model for better aesthetic analysis
        'messages': messages,
        'stream': False
    }

    headers = {
        'Authorization': f"Bearer {api_key}",
        'Content-Type': 'application/json'
    }

    try:
        log_debug("AI_API", f"Calling {API_BASE}v1/chat/completions (VL)", body)
        
        # Unified Guard (Rate Limit + Circuit Breaker)
        ai_gateway.guard("modelscope", api_key)
        
        r = requests.post(
            f"{API_BASE}v1/chat/completions",
            headers=headers,
            data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
            timeout=30
        )
        r.raise_for_status()
        resp_json = r.json()
        result = resp_json['choices'][0]['message']['content'].strip()
        print(f"Qwen3VL Analysis: {result}")
        _ai_circuit_record_success("modelscope", api_key)

        # Try to parse JSON list
        try:
            # Clean markdown if present
            clean_json = result.replace('```json', '').replace('```', '').strip()
            suggestions = json.loads(clean_json)
            if isinstance(suggestions, list):
                return suggestions
        except:
            print("Failed to parse JSON suggestions, returning raw as single item")
            return [result]

        return [result] # Fallback
    except Exception as e:
        if not isinstance(e, AICircuitOpenError) and not isinstance(e, HTTPException):
            _ai_circuit_record_failure("modelscope", api_key, datetime.datetime.now())
        print(f"Qwen3VL Analysis Failed: {e}")
        return ["High quality photo, artistic style"]

@app.post("/candypixel/api/vision/analyze")
def vision_analyze(req: VisionAnalyzeRequest, request: Request, db: Session = Depends(get_db)):
    # 1. Auth (Opt-in: Can be public if needed, but safer with auth)
    auth = request.headers.get('Authorization')
    if not auth: raise HTTPException(status_code=401, detail="Missing Token")
    token = auth.split(' ')[1]
    if not get_user_by_token(token, db): raise HTTPException(status_code=401, detail="Invalid Token")

    # 2. Upload to OSS
    url = upload_base64_to_oss(req.image)
    if not url:
        raise HTTPException(status_code=500, detail="Image Upload Failed")

    # 3. Analyze
    suggestions = analyze_image_with_qwen3vl(url)

    return {
        "code": 200,
        "data": {
            "ossUrl": url,
            "creativeSuggestions": suggestions # Returns List[str]
        }
    }

@app.post("/candypixel/api/generate-edit")
def api_generate_edit(req: GenerateEditRequest, request: Request, db: Session = Depends(get_db)):
    log_debug("API", "Received Generate-Edit Request", req.dict())
    
    # 1. Auth
    auth = request.headers.get('Authorization')
    if not auth: raise HTTPException(status_code=401, detail="Missing Token")
    token = auth.split(' ')[1]
    user = get_user_by_token(token, db)
    if not user: raise HTTPException(status_code=401, detail="Invalid Token")
    
    # Check Daily Limit
    check_daily_limit(db, user.id)
    
    # 2. Check Balance
    cost = 1 # Editing is cheap
    balance_rec = db.query(UserBalance).filter(UserBalance.user_id == user.id).first()
    if not balance_rec or balance_rec.balance < cost:
        raise HTTPException(status_code=402, detail="积分不足")

    # 3. Process Images
    # We need to upload Base64 images to OSS to get URLs for Aliyun
    base_url = ensure_public_url(req.baseImage)
    if not base_url:
        raise HTTPException(status_code=500, detail="Base Image Upload Failed")
        
    mask_url = None
    if req.maskImage:
        mask_url = ensure_public_url(req.maskImage)
        
    ref_url = None
    if req.refImage:
        ref_url = ensure_public_url(req.refImage)
        
    # 4. Construct Prompt
    # Start with user prompt or style
    final_prompt = req.prompt or ""
    if req.style:
        if final_prompt: final_prompt += f", {req.style}"
        else: final_prompt = req.style
        
    # If Ref Image exists, Analyze it to get style prompt
    # [2025-12-22] User Request: Completely disabled automatic Ref Image Style Analysis
    # if ref_url and not final_prompt:
    #     log_debug("API", "Analyzing Ref Image for Style", {"ref_url": ref_url})
    #     try:
    #         # Re-use analyze logic but maybe simpler? 
    #         # Let's use Qwen-VL to describe the STYLE of the ref image
    #         vl_suggestions = analyze_image_with_qwen3vl(ref_url)
    #         if vl_suggestions and len(vl_suggestions) > 0:
    #             # Take the first suggestion as style description
    #             style_desc = vl_suggestions[0]
    #             final_prompt += f". Style Reference: {style_desc}"
    #     except Exception as e:
    #         print(f"Ref Image Analysis Failed: {e}")
    #         # Continue without ref style analysis
            
    if not final_prompt:
        final_prompt = "High quality, keep original content"

    # 5. Construct Image List for Qwen-Image-Edit
    # If Mask exists: [Base, Mask] -> Model interprets 2nd image as mask
    # If No Mask: [Base] -> Model edits globally
    input_images = [base_url]
    if mask_url:
        input_images.append(mask_url)
        # Add instruction to be safe
        final_prompt += ". The second image is a mask, please edit ONLY the masked area."
    
    # Align with candypixel/api/edit: Pass Ref Image if present
    if ref_url:
        input_images.append(ref_url)
        
    log_debug("API", "Submitting to Qwen-Image-Edit", {"prompt": final_prompt, "images": input_images})
    
    # 获取随机KEY和KEY ID
    key, key_id = key_manager.get_random_key()
    if not key:
        raise HTTPException(status_code=500, detail="No API Key available")
    
    aliyun_task_id = create_qwen_edit_task(key, final_prompt, input_images)
        
    # 6. Create Project Record - 保存 key_id 用于状态轮询
    project_id = f"P{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"
    project = UserProject(
        project_id=project_id,
        user_id=user.id,
        type='EDITING', 
        status='PROCESSING',
        prompt=final_prompt,
        template_id=None, 
        cost_points=cost, 
        input_images={
            "provider": "aliyun",
            "aliyun_task_id": aliyun_task_id,
            "api_key_id": key_id,  # 保存KEY ID用于状态轮询
            "original_inputs": input_images,
            "ref_image": ref_url,
            "attempt_count": 1,
            "retry_count": 0
        }
    )
    db.add(project)
    
    # 7. Deduct Balance (Pre-deduct or Post? Logic says post usually but here we do pre for simplicity or stick to post?)
    # Existing logic in api_generate uses deduct_balance_internal immediately.
    # Existing get_project_status logic ALSO deducts? Wait.
    # In `get_project_status`: "Deduct balance ... if success".
    # In `api_generate`: "Deduct balance ... db.commit()".
    # This implies double deduction if I'm not careful.
    # Let's check api_generate again.
    # api_generate calls deduct_balance_internal.
    # get_project_status calls deduct_balance_internal ONLY IF p.cost_points > 0?
    # Actually get_project_status checks: `success, msg = deduct_balance_internal(...)`.
    # Let's look at deduct_balance_internal implementation.
    # If I deduct here, I should set cost_points to 0 in Project so get_project_status doesn't deduct again?
    # OR, I don't deduct here, and let get_project_status deduct.
    # The `api_generate` DOES deduct.
    # Let's check `get_project_status` logic again.
    
    # Let's be consistent with `api_generate`: Deduct NOW.
    deduct_balance_internal(user.id, cost, "光影演绎", project_id, db)
    db.commit()
    
    return {
        "code": 200,
        "data": {
            "project_id": project_id,
            "status": "PROCESSING",
            "eta": 15
        }
    }

@app.post("/candypixel/api/edit")
def api_edit(req: EditRequest, request: Request, db: Session = Depends(get_db)):
    log_debug("API", "Received Edit Request", req.dict())
    
    # 1. Auth
    auth = request.headers.get('Authorization')
    if not auth: raise HTTPException(status_code=401, detail="Missing Token")
    token = auth.split(' ')[1]
    user = get_user_by_token(token, db)
    if not user: raise HTTPException(status_code=401, detail="Invalid Token")

    check_daily_limit(db, user.id)
    
    # 2. Prepare
    # full_prompt = build_edit_prompt(req.op, req.prompt) # logic from app.py
    base = req.prompt or ''
    # Simple mapping
    full_prompt = base
    
    # 2.5 Check Balance (不扣分，成功后才扣)
    cost = 1
    balance_rec = db.query(UserBalance).filter(UserBalance.user_id == user.id).first()
    if not balance_rec or balance_rec.balance < cost:
        raise HTTPException(status_code=402, detail="积分不足")
    
    # 获取随机KEY和KEY ID
    key, key_id = key_manager.get_random_key()
    if not key:
        raise HTTPException(status_code=500, detail="No API Key available")
    
    # 3. Upload Images
    images_to_process = [req.baseImage]
    if req.additionalImages: images_to_process.extend(req.additionalImages)
    
    oss_urls = [ensure_public_url(req.baseImage)]
    
    if req.mask:
        oss_urls.append(ensure_public_url(req.mask))
        
    if req.additionalImages:
        for img in req.additionalImages:
            oss_urls.append(ensure_public_url(img))
    
    # 4. Submit
    aliyun_task_id = create_qwen_edit_task(key, full_prompt, oss_urls)
    
    # 5. Project - 保存 key_id 用于状态轮询
    project_id = f"P{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"
    project = UserProject(
        project_id=project_id,
        user_id=user.id,
        type='EDITING', 
        status='PROCESSING',
        prompt=full_prompt,
        template_id=None, 
        cost_points=1, 
        input_images={
            "provider": "aliyun",
            "aliyun_task_id": aliyun_task_id,
            "api_key_id": key_id,  # 保存KEY ID用于状态轮询
            "original_inputs": oss_urls,
            "attempt_count": 1,
            "retry_count": 0
        }
    )
    db.add(project)
    db.commit()
    
    res = {"taskId": project_id, "project_id": project_id, "status": "PENDING"}
    log_debug("API", "Edit Response", res)
    return res

def upload_url_to_oss(url):
    try:
        # Create a session with retries (same as download_and_convert_to_base64)
        session = get_requests_session()
        
        # Download
        r = session.get(url, timeout=30)
        if r.status_code != 200: return url # Fallback to original
        
        # Upload
        bucket = get_oss_bucket()
        if not bucket: return url
        
        content = r.content
        ext = 'jpg' # Default
        if 'png' in url or url.endswith('.png'): ext = 'png'
        
        file_name = f"candypixel/results/{datetime.datetime.now().strftime('%Y%m%d')}/{uuid.uuid4().hex}.{ext}"
        # Set public-read ACL
        bucket.put_object(file_name, content, headers={'x-oss-object-acl': 'public-read'})
        
        host = os.getenv('OSS_PUBLIC_HOST', f'https://{bucket.bucket_name}.{bucket.endpoint}')
        return f"{host.rstrip('/')}/{file_name}"
    except Exception as e:
        print(f"OSS Result Upload Failed: {e}")
        return url

def download_and_convert_to_base64(url):
    try:
        # Use shared session with retries
        session = get_requests_session()
        
        # Increase timeout to 15s
        r = session.get(url, timeout=15)
        if r.status_code != 200: return None
        encoded = base64.b64encode(r.content).decode('utf-8')
        mime_type = "image/png" # Default fallback
        if url.lower().endswith('.jpg') or url.lower().endswith('.jpeg'):
            mime_type = "image/jpeg"
        elif url.lower().endswith('.gif'):
            mime_type = "image/gif"
        elif url.lower().endswith('.webp'):
            mime_type = "image/webp"
            
        return f"data:{mime_type};base64,{encoded}"
    except Exception as e:
        print(f"Download and convert to base64 failed: {e}")
        return None

# System Robustness Constants
MAX_AI_TOTAL_ATTEMPTS = 3

@app.get("/candypixel/api/projects/{pid}")
def get_project_status(pid: str, request: Request, db: Session = Depends(get_db)):
    # JWT Authentication - verify user identity
    auth = request.headers.get('Authorization')
    if not auth:
        raise HTTPException(status_code=401, detail="Missing Token")
    token = auth.split(' ')[1] if ' ' in auth else auth
    user = get_user_by_token(token, db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid Token")
    
    p = db.query(UserProject).filter(UserProject.project_id == pid).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Project ownership verification - prevent unauthorized access
    if p.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied: not your project")
        
    # Lazy Polling
    if p.status == 'PROCESSING':
        # Safety Net: Backend Timeout (e.g. 5 minutes)
        # Prevents "Zombie" tasks if Frontend disconnects or AI Provider hangs indefinitely without error.
        if p.created_at and (datetime.datetime.now() - p.created_at).total_seconds() > 300:
             p.status = 'FAILED'
             p.error_msg = 'Task Timed Out (System Protection)'
             db.commit()
             return {"code": 200, "data": p.to_dict()}

        aliyun_task_id = None
        api_key_id = None
        if p.input_images and isinstance(p.input_images, dict):
            aliyun_task_id = p.input_images.get('aliyun_task_id')
            api_key_id = p.input_images.get('api_key_id')  # 获取创建任务时使用的KEY ID
            
        if aliyun_task_id:
            # 使用保存的KEY ID获取相同的API KEY,确保状态轮询使用创建任务时的同一个KEY
            if api_key_id:
                key = key_manager.get_key_by_id(api_key_id)
                if not key:
                    log_debug("POLLING", f"KEY ID {api_key_id} not found, using random key as fallback")
                    key, _ = key_manager.get_random_key()
            else:
                # 兼容旧数据(没有保存key_id的项目)
                log_debug("POLLING", f"No key_id found for project {pid}, using random key")
                key, _ = key_manager.get_random_key()
            
            if not key:
                p.status = 'FAILED'
                p.error_msg = 'No API Key available for status check'
                db.commit()
                return {"code": 200, "data": p.to_dict()}
            
            status, results, detail = check_aliyun_status(key, aliyun_task_id)
            
            if status == 'SUCCEEDED':
                # Process results: Upload to OSS + Convert to base64
                oss_urls = []
                base64_images = []
                
                if results:
                    for aliyun_url in results:
                        # Upload to our OSS for record keeping
                        oss_url = upload_url_to_oss(aliyun_url)
                        oss_urls.append(oss_url)
                        
                        # Convert to base64 for WeChat frontend
                        b64 = download_and_convert_to_base64(aliyun_url)
                        if b64:
                            base64_images.append(b64)
                
                # Deduct balance
                # NOTE: CREATION and EDITING deduct upfront in their endpoints.
                # TEMPLATE does not deduct upfront, so we deduct here on success.
                success = True
                msg = ""
                
                if p.type == 'TEMPLATE':
                    user_id = p.user_id
                    cost = p.cost_points if p.cost_points else 1
                    
                    # Determine meaningful reason
                    reason = 'AI Generation'
                    if p.template_id:
                        tpl = db.query(BusinessPromptStyleTemplate).get(p.template_id)
                        if tpl:
                            reason = f"应用模版: {tpl.name}"
                        else:
                            reason = "应用模版"
                            
                    success, msg = deduct_balance_internal(user_id, cost, reason, p.project_id, db)
                
                if success:
                    p.status = 'SUCCESS'
                    p.result_images = oss_urls  # Store OSS URLs in DB
                    p.updated_at = datetime.datetime.now()
                    db.commit()
                    
                    # Return with base64 for frontend display
                    result = p.to_dict()
                    result['display_images'] = base64_images  # Add base64 for display
                    return {"code": 200, "data": result}
                else:
                    p.status = 'FAILED'
                    p.error_msg = f'Payment Failed: {msg}'
                    db.commit()
                    
            elif status == 'FAILED':
                # Auto-retry logic with robust JSON update
                log_debug("TASK", f"Project {pid} Task Failed. Checking retry eligibility...", {"detail": detail})
                
                orig = None
                current_meta = {}
                attempt_count = 1
                
                try:
                    if isinstance(p.input_images, dict):
                        # COPY the dict to ensure SQLAlchemy detects changes upon reassignment
                        current_meta = dict(p.input_images)
                        orig = current_meta.get('original_inputs')
                        attempt_count = current_meta.get('attempt_count', 1)
                    else:
                        current_meta = {}
                        attempt_count = 1
                except Exception as e:
                    log_debug("TASK", "Error parsing input_images for retry", str(e))
                    attempt_count = 999

                # ---------------------------------------------------------
                # OPTIMISTIC LOCKING to prevent Concurrent Retries (Fix for error1.log)
                # ---------------------------------------------------------
                now_ts = time.time()
                last_lock = current_meta.get('retry_lock', 0)
                
                # If locked within last 30s, assume another process is handling it
                if (now_ts - last_lock) < 30:
                     log_debug("TASK", f"Skipping concurrent retry for {pid}. Lock active.")
                     # Return "PROCESSING" state to frontend so it keeps polling without error
                     # We fake the response status here, while the DB is still FAILED (until the locker updates it)
                     resp_data = p.to_dict()
                     resp_data['status'] = 'PROCESSING'
                     return {"code": 200, "data": resp_data}
                
                # Robustness Logic:
                can_retry = attempt_count < MAX_AI_TOTAL_ATTEMPTS and (
                    (orig and isinstance(orig, list) and len(orig) > 0) or 
                    (p.prompt and len(p.prompt) > 0)
                )

                if can_retry:
                    # Acquire Lock FIRST with Refresh
                    try:
                        # Refresh object from DB to reduce race condition window
                        db.refresh(p)
                        # Double check lock after refresh
                        current_meta = dict(p.input_images) if p.input_images else {}
                        last_lock_refresh = current_meta.get('retry_lock', 0)
                        if (time.time() - last_lock_refresh) < 30:
                             log_debug("TASK", f"Race condition detected for {pid}. Aborting retry.")
                             resp_data = p.to_dict()
                             resp_data['status'] = 'PROCESSING'
                             return {"code": 200, "data": resp_data}

                        current_meta['retry_lock'] = now_ts
                        p.input_images = current_meta
                        db.commit() 
                    except Exception as e:
                        # If DB commit fails, maybe race condition, abort
                        log_debug("TASK", "Failed to acquire retry lock", str(e))
                        resp_data = p.to_dict()
                        resp_data['status'] = 'PROCESSING'
                        return {"code": 200, "data": resp_data}

                    try:
                        log_debug("TASK", f"Retrying Project {pid}. Attempt {attempt_count + 1}/{MAX_AI_TOTAL_ATTEMPTS}")
                        
                        # Use same prompt and images
                        new_task = None
                        
                        # 1. Image-to-Image / Editing (Has Original Images)
                        if orig and isinstance(orig, list) and len(orig) > 0:
                            new_task = create_qwen_edit_task(key, p.prompt or '', orig)
                            log_debug("TASK", "Retrying with Image-to-Image")
                            
                        # 2. Text-to-Image (No Images, but has Prompt)
                        # Covers: Creation, Meme (Text Mode), Template (Text Mode)
                        elif p.prompt:
                             new_task = submit_to_aliyun(key, p.prompt)
                             log_debug("TASK", "Retrying with Text-to-Image")
                        
                        if new_task:
                            # Update metadata
                            current_meta['aliyun_task_id'] = new_task
                            current_meta['retry_count'] = attempt_count
                            current_meta['attempt_count'] = attempt_count + 1
                            current_meta['last_error'] = str(detail)
                            current_meta.pop('retry_lock', None) # Release lock
                            
                            # CRITICAL: Reassign to trigger SQL update
                            p.input_images = current_meta
                            p.status = 'PROCESSING'
                            p.updated_at = datetime.datetime.now()
                            
                            db.commit()
                            
                            log_debug("TASK", f"Retry Submitted. New Task ID: {new_task}")
                            return {"code": 200, "data": p.to_dict()}
                        else:
                            log_debug("TASK", "Retry failed: No valid inputs for retry")
                        
                    except Exception as e:
                        log_debug("TASK", "Retry Submission Failed", str(e))
                        # If retry submission fails, we let it fall through to final failure
                        pass
                
                # Record failure detail (Final Failure)
                log_debug("TASK", f"Project {pid} Final Failure. Retries exhausted or non-retriable.")
                p.status = 'FAILED'
                attempts_for_msg = attempt_count if isinstance(attempt_count, int) and attempt_count > 0 else 1
                p.error_msg = f"{detail or 'AI Generation Failed'} (已尝试{attempts_for_msg}次)"
                # Ensure lock is cleared
                if 'retry_lock' in current_meta:
                    current_meta.pop('retry_lock')
                    p.input_images = current_meta
                    
                db.commit()
                
    # Self-healing: Check for dirty URLs in SUCCESS state
    if p.status == 'SUCCESS' and p.result_images:
        dirty = False
        clean_images = []
        # Ensure result_images is a list
        images = p.result_images if isinstance(p.result_images, list) else []
        
        for img in images:
            if isinstance(img, str) and ('`' in img or img.strip() != img):
                dirty = True
                clean_images.append(img.strip().strip('`').strip())
            else:
                clean_images.append(img)
        
        if dirty:
            print(f"Self-healing project {pid}: cleaned dirty URLs")
            p.result_images = clean_images
            db.commit()

    return {
        "code": 200,
        "data": p.to_dict()
    }

# Image Detection Endpoint
class DetectRequest(BaseModel):
    image: str

def analyze_image_with_qwen(image_url: str):
    """Analyze image using Qwen-VL model"""
    api_key, _ = key_manager.get_random_key()  # 辅助函数不需要保存key_id
    if not api_key:
        raise Exception("Missing API Key")
    
    system_prompt = """你是一个专业的图像分析师。请分析这张图片，返回JSON格式：
{
  "description": "图片描述",
  "scores": { "clarity": 80, "lighting": 75, "composition": 85, "color": 70 },
  "issues": ["问题1", "问题2"],
  "suggestionPrompt": "改进建议提示词"
}
只返回JSON，不要Markdown。"""

    body = {
        'model': 'Qwen/Qwen3-VL-8B-Instruct',
        'messages': [{
            'role': 'user',
            'content': [
                {'type': 'text', 'text': system_prompt},
                {'type': 'image_url', 'image_url': {'url': image_url}},
            ],
        }],
        'stream': False 
    }
    
    headers = {
        'Authorization': f"Bearer {api_key}",
        'Content-Type': 'application/json'
    }

    log_debug("AI_API", "Calling Qwen-VL for Analysis", body)
    try:
        # Unified Guard (Rate Limit + Circuit Breaker)
        ai_gateway.guard("modelscope", api_key)
        
        r = requests.post(
            f"{API_BASE}v1/chat/completions",
            headers=headers,
            data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
            timeout=30
        )
        r.raise_for_status()
        resp_json = r.json()
        log_debug("AI_API", "Qwen-VL Analysis Response", resp_json)
        _ai_circuit_record_success("modelscope", api_key)
        return resp_json['choices'][0]['message']['content']
    except Exception as e:
        if not isinstance(e, AICircuitOpenError) and not isinstance(e, HTTPException):
            _ai_circuit_record_failure("modelscope", api_key, datetime.datetime.now())
        print(f"Qwen-VL Analysis Failed: {e}")
        raise

def parse_analysis_result(text: str):
    """Parse JSON result from Qwen-VL"""
    import re
    try:
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            return json.loads(match.group(0))
    except:
        pass
    return {
        "description": "分析失败",
        "scores": {"clarity": 50, "lighting": 50, "composition": 50, "color": 50},
        "issues": ["解析失败"],
        "suggestionPrompt": "high quality"
    }

@app.post("/candypixel/api/image-detect")
def image_detect(data: DetectRequest):
    log_debug("API", "Received Image Detect Request", data.dict())
    try:
        oss_url = ensure_public_url(data.image)
        
        if not oss_url.startswith('http'):
            return {"code": 500, "error": "OSS Upload Failed"}

        raw_analysis = analyze_image_with_qwen(oss_url)
        structured_analysis = parse_analysis_result(raw_analysis)
        
        res = {
            "status": "success",
            "ossUrl": oss_url,
            "raw": raw_analysis,
            "analysis": structured_analysis
        }
        log_debug("API", "Image Detect Response", res)
        return res
    except Exception as e:
        print(f"Image Detect Failed: {e}")
        return {"code": 500, "error": str(e)}

# User Balance Endpoint - MOVED TO pixel_user_service.py
# @app.get("/candypixel/api/user/balance")
# def get_user_balance(request: Request, db: Session = Depends(get_db)):
#     auth = request.headers.get('Authorization')
#     if not auth:
#         raise HTTPException(status_code=401, detail="Missing Token")
#     token = auth.split(' ')[1]
#     user = get_user_by_token(token, db)
#     if not user:
#         raise HTTPException(status_code=401, detail="Invalid Token")
    
#     balance_rec = db.query(UserBalance).filter(UserBalance.user_id == user.id).first()
#     return {
#         "code": 200,
#         "data": {
#             "balance": balance_rec.balance if balance_rec else 0,
#             "user_id": user.id,
#             "nickname": user.nick
#         }
#     }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 12016))
    uvicorn.run(app, host="0.0.0.0", port=port)
