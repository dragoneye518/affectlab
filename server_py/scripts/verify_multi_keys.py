#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
验证多API KEY功能
测试:
1. 多KEY随机分配是否正常
2. 每个KEY能否成功调用AI API
3. KEY ID机制是否正确工作
"""
import os
import sys
from dotenv import load_dotenv

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 加载环境变量
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(root_dir, '.env.local'))
load_dotenv(os.path.join(root_dir, '.env'))

from utils.key_manager import key_manager
import requests
import json

API_BASE = 'https://api-inference.modelscope.cn/'

def test_key_manager():
    """测试KeyManager基本功能"""
    print("\n" + "="*60)
    print("测试 1: KeyManager 基本功能")
    print("="*60)
    
    if not key_manager.keys:
        print("❌ 错误: 没有加载到任何API KEY!")
        print("   请在 .env.local 中配置 MODELSCOPE_API_KEYS")
        return False
    
    print(f"✓ 成功加载 {len(key_manager.keys)} 个API KEY")
    
    # 测试随机获取
    print("\n测试随机获取KEY (10次):")
    key_usage = {}
    for i in range(10):
        key, key_id = key_manager.get_random_key()
        if key:
            short_key = f"{key[:12]}...{key[-4:]}"
            if short_key not in key_usage:
                key_usage[short_key] = 0
            key_usage[short_key] += 1
            print(f"  [{i+1}] KEY: {short_key}, ID: {key_id}")
    
    print(f"\n✓ KEY使用分布: {key_usage}")
    
    # 测试KEY ID查找
    print("\n测试KEY ID查找:")
    for key in key_manager.keys:
        key_id = key_manager._generate_key_id(key)
        found_key = key_manager.get_key_by_id(key_id)
        if found_key == key:
            print(f"  ✓ KEY ID {key_id} 查找成功")
        else:
            print(f"  ❌ KEY ID {key_id} 查找失败!")
            return False
    
    return True

def test_api_call():
    """测试每个KEY能否成功调用AI API"""
    print("\n" + "="*60)
    print("测试 2: 测试每个KEY调用AI API")
    print("="*60)
    
    if not key_manager.keys:
        print("❌ 没有可用的API KEY")
        return False
    
    success_count = 0
    for idx, key in enumerate(key_manager.keys, 1):
        short_key = f"{key[:12]}...{key[-4:]}"
        print(f"\n测试 KEY {idx}/{len(key_manager.keys)}: {short_key}")
        
        headers = {
            'Authorization': f"Bearer {key}",
            'Content-Type': 'application/json',
            'X-ModelScope-Async-Mode': 'true'
        }
        
        body = {
            'model': 'Tongyi-MAI/Z-Image-Turbo',
            'prompt': 'A cute cat, test image'
        }
        
        try:
            r = requests.post(
                f"{API_BASE}v1/images/generations",
                headers=headers,
                data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
                timeout=10
            )
            
            if r.status_code == 200:
                resp_json = r.json()
                task_id = resp_json.get('task_id')
                print(f"  ✓ 调用成功! Task ID: {task_id}")
                success_count += 1
            else:
                print(f"  ❌ 调用失败! Status: {r.status_code}")
                print(f"     Response: {r.text[:200]}")
        except Exception as e:
            print(f"  ❌ 调用异常: {str(e)}")
    
    print(f"\n总结: {success_count}/{len(key_manager.keys)} 个KEY调用成功")
    return success_count > 0

def test_key_consistency():
    """测试KEY ID一致性机制"""
    print("\n" + "="*60)
    print("测试 3: KEY ID一致性机制")
    print("="*60)
    
    # 模拟创建任务时保存KEY ID
    key, key_id = key_manager.get_random_key()
    if not key:
        print("❌ 无法获取KEY")
        return False
    
    short_key = f"{key[:12]}...{key[-4:]}"
    print(f"模拟创建任务:")
    print(f"  使用KEY: {short_key}")
    print(f"  保存KEY ID: {key_id}")
    
    # 模拟状态轮询时根据KEY ID恢复相同KEY
    print(f"\n模拟状态轮询:")
    recovered_key = key_manager.get_key_by_id(key_id)
    
    if recovered_key == key:
        print(f"  ✓ 成功恢复相同KEY: {short_key}")
        print(f"  ✓ KEY一致性验证通过!")
        return True
    else:
        print(f"  ❌ KEY恢复失败!")
        print(f"     期望: {short_key}")
        print(f"     实际: {recovered_key[:12] if recovered_key else 'None'}...")
        return False

def main():
    print("\n" + "="*60)
    print("多API KEY功能验证脚本")
    print("="*60)
    
    results = []
    
    # 测试1: KeyManager基本功能
    results.append(("KeyManager基本功能", test_key_manager()))
    
    # 测试2: API调用
    results.append(("API调用测试", test_api_call()))
    
    # 测试3: KEY一致性
    results.append(("KEY一致性机制", test_key_consistency()))
    
    # 总结
    print("\n" + "="*60)
    print("测试总结")
    print("="*60)
    for name, result in results:
        status = "✓ 通过" if result else "❌ 失败"
        print(f"{status} - {name}")
    
    all_passed = all(r for _, r in results)
    if all_passed:
        print("\n🎉 所有测试通过!")
        return 0
    else:
        print("\n⚠️  部分测试失败,请检查配置")
        return 1

if __name__ == "__main__":
    sys.exit(main())
