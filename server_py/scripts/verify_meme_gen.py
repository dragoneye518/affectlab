import sys
import os
import requests
import json
import time
import jwt
import datetime

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Try to import DB config
try:
    from mysql_config import SessionLocal
    from pixel_models import UserProfile, UserBalance
except ImportError:
    print("Could not import server modules. Make sure you are in the correct directory.")
    sys.exit(1)

# Configuration
API_URL = "http://127.0.0.1:12016"
SECRET_KEY = os.getenv('SECRET_KEY', 'candy-pixel-secret-key-2025')

def get_test_token():
    db = SessionLocal()
    try:
        user = db.query(UserProfile).first()
        if not user:
            print("No users found in DB. Please run init data or register a user.")
            return None, None
        
        user_id = user.id
        payload = {
            'user_id': user_id,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7),
            'iat': datetime.datetime.utcnow()
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
        return token, user_id
    finally:
        db.close()

def get_balance(headers):
    try:
        res = requests.get(f"{API_URL}/candypixel/api/user/balance", headers=headers)
        if res.status_code == 200:
            return res.json()['data']['balance']
    except Exception as e:
        print(f"Failed to get balance: {e}")
    return 0

def test_meme_gen_deduction():
    print(">>> Testing Meme Gen Deduction...")
    token, user_id = get_test_token()
    if not token: return

    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Check Balance Before
    bal_before = get_balance(headers)
    print(f"User ID: {user_id}")
    print(f"Balance Before: {bal_before}")
    
    # 2. Call Generate API (Text Only - Cheapest/Fastest)
    url = f"{API_URL}/candypixel/api/meme-gen"
    data = {
        "scene_description": "Test Deduction " + str(time.time()),
        "style_id": "PIXEL_ART"
    }
    
    try:
        res = requests.post(url, json=data, headers=headers)
        print(f"API Response: {res.status_code}")
        
        if res.status_code == 402:
            print("❌ Insufficient Balance. Please add credits first.")
            return
            
        if res.status_code != 200:
            print(f"Error: {res.text}")
            return
            
        # 3. Check Balance Immediately (Upfront Deduction)
        bal_after = get_balance(headers)
        print(f"Balance After: {bal_after}")
        
        cost = bal_before - bal_after
        print(f"Cost Deducted: {cost}")
        
        if cost == 3:
            print("✅ SUCCESS: 3 points deducted.")
        else:
            print(f"❌ FAILURE: Expected 3, got {cost}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to server. Is it running?")

if __name__ == "__main__":
    test_meme_gen_deduction()
