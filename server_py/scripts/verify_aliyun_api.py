import os
import requests
import json
import time
from dotenv import load_dotenv

# Load env
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(root_dir, '.env.local'))
load_dotenv(os.path.join(root_dir, '.env'))

API_KEY = os.getenv('DASHSCOPE_API_KEY') or os.getenv('MODELSCOPE_API_KEY')
if not API_KEY:
    # Try to find it in the file if not in env (dev environment fallback)
    try:
        with open('.env.local', 'r') as f:
            for line in f:
                if 'DASHSCOPE_API_KEY' in line:
                    API_KEY = line.split('=')[1].strip()
                    break
    except:
        pass

print(f"Using API Key: {API_KEY[:6]}...")

API_BASE = 'https://api-inference.modelscope.cn/'

def test_z_image_turbo():
    print("\n--- Testing Z-Image-Turbo ---")
    headers = {
        'Authorization': f"Bearer {API_KEY}",
        'Content-Type': 'application/json',
        'X-ModelScope-Async-Mode': 'true'
    }
    
    # Payload Pattern 1: OpenAI Compatible (Top level)
    body_1 = {
        'model': 'Tongyi-MAI/Z-Image-Turbo',
        'prompt': 'A cute cat running in the park',
        'n': 1,
        'size': '1024x1024'
    }
    
    # Payload Pattern 2: ModelScope Standard (Input nested)
    body_2 = {
        'model': 'Tongyi-MAI/Z-Image-Turbo',
        'input': {
            'prompt': 'A cute cat running in the park'
        },
        'parameters': {
            'size': '1024*1024',
            'n': 1
        }
    }

    # Test 1: Sync Mode (No Header)
    print("\nTest 1: Sync Mode (No Async Header)...")
    headers_sync = {
        'Authorization': f"Bearer {API_KEY}",
        'Content-Type': 'application/json'
    }
    try:
        r = requests.post(
            f"{API_BASE}v1/images/generations",
            headers=headers_sync,
            data=json.dumps(body_1),
            timeout=60
        )
        print(f"Status: {r.status_code}")
        print(f"Response: {r.text}")
    except Exception as e:
        print(f"Error: {e}")

    # Test 8: Qwen-Image-Edit (Sync + Top Level)
    print("\n--- Testing Qwen-Image-Edit (Sync + Top Level) ---")
    headers_sync = {
        'Authorization': f"Bearer {API_KEY}",
        'Content-Type': 'application/json'
    }
    
    # Use a dummy public image
    base_img = "https://img.alicdn.com/imgextra/i4/O1CN01QYqP1S1fKkQYqP1S_!!6000000003994-2-tps-512-512.png"

    body_qwen_sync = {
        'model': 'Qwen/Qwen-Image-Edit-2509',
        'prompt': 'Make it night time',
        'image_url': [base_img]
    }
    
    try:
        r = requests.post(
            f"{API_BASE}v1/images/generations",
            headers=headers_sync,
            data=json.dumps(body_qwen_sync),
            timeout=60
        )
        print(f"Status: {r.status_code}")
        print(f"Response: {r.text}")
    except Exception as e:
        print(f"Error: {e}")



def wait_for_task(task_id, headers):
    print(f"Waiting for Task {task_id}...")
    for i in range(20):
        time.sleep(2)
        r = requests.get(f"{API_BASE}v1/tasks/{task_id}", headers=headers)
        res = r.json()
        status = res.get('task_status')
        print(f"[{i}] Status: {status}")
        if status == 'SUCCEEDED':
            print("SUCCESS!")
            print(json.dumps(res, indent=2))
            return
        if status == 'FAILED':
            print("FAILED!")
            print(res)
            return

if __name__ == "__main__":
    test_z_image_turbo()
