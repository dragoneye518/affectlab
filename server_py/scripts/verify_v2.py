from fastapi.testclient import TestClient
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pixel_aigc_server import app as aigc_app

def test_v2_services():
    print("=== Testing Pixel V2 Unified Service ===")
    
    client = TestClient(aigc_app)

    # 1. Test AIGC Service: List Templates
    print("\n[Unified] Testing /candypixel/api/templates...")
    resp = client.get("/candypixel/api/templates")
    if resp.status_code == 200:
        data = resp.json()
        print(f"✅ Templates List Success. Count: {len(data['data'])}")
    else:
        print(f"❌ List Templates Failed: {resp.status_code} {resp.text}")

    # 2. Test User Service (Mounted): Balance
    print("\n[Unified] Testing /candypixel/api/user/balance (No Token)...")
    resp = client.get("/candypixel/api/user/balance")
    if resp.status_code == 401:
        print("✅ Correctly rejected missing token (401)")
    else:
        print(f"❌ Expected 401, got {resp.status_code}")

    # 3. Test User Service (Mounted): Login
    print("\n[Unified] Testing /candypixel/api/user/login (Mock)...")
    resp = client.post("/candypixel/api/user/login", json={"code": "mock_code", "userInfo": {}})
    token = None
    if resp.status_code == 200:
         rdata = resp.json()
         print(f"✅ Login Success: {rdata['msg']}")
         token = rdata['data']['token']
    else:
         print(f"❌ Login Failed: {resp.status_code} {resp.text}")
         return

    if not token:
        print("❌ no token, stopping.")
        return

    # 4. Test Generation (Requires Template ID)
    # Get first template
    tpl_resp = client.get("/candypixel/api/templates")
    tpls = tpl_resp.json()['data']
    if not tpls:
        print("❌ No templates found, cannot test generation")
        return
    
    tid = tpls[0]['id']
    print(f"\n[Unified] Testing Generation with Template ID {tid}...")
    
    gen_payload = {
        "template_id": tid,
        "prompt": "Test Prompt",
        "input_images": []
    }
    
    gen_resp = client.post(
        "/candypixel/api/generate/template",
        json=gen_payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if gen_resp.status_code == 200:
        pdata = gen_resp.json()
        pid = pdata['data']['project_id']
        print(f"✅ Generation Started. Project ID: {pid}")
        
        # 5. Test Polling
        print(f"\n[Unified] Polling Project {pid}...")
        # We can't actually wait for Aliyun in a mock test unless we mock the submit/check functions in pixel_aigc_server.
        # But we can at least check if the endpoint returns.
        poll_resp = client.get(f"/candypixel/api/projects/{pid}")
        if poll_resp.status_code == 200:
            status = poll_resp.json()['data']['status']
            print(f"✅ Polling Success. Current Status: {status}")
        else:
            print(f"❌ Polling Failed: {poll_resp.status_code} {poll_resp.text}")
            
    else:
        print(f"❌ Generation Failed: {gen_resp.status_code} {gen_resp.text}")

if __name__ == "__main__":
    test_v2_services()
