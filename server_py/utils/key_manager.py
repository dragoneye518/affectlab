# -*- coding: utf-8 -*-
"""
ModelScope API Key Manager
支持多KEY随机分配，状态轮询保持KEY一致性
"""
import random
import os
import hashlib

class KeyManager:
    """ModelScope API Key管理器，支持多Key随机分配"""
    
    def __init__(self, keys=None):
        if keys:
            self.keys = keys
        else:
            # 优先从 MODELSCOPE_API_KEYS 加载（逗号分隔）
            env_keys = os.getenv('MODELSCOPE_API_KEYS', '')
            if env_keys:
                self.keys = [k.strip() for k in env_keys.split(',') if k.strip()]
            else:
                # 备用: ALIYUN_API_KEYS
                env_keys = os.getenv('ALIYUN_API_KEYS', '')
                if env_keys:
                    self.keys = [k.strip() for k in env_keys.split(',') if k.strip()]
                else:
                    # 最后回退到单一KEY (兼容性)
                    default_key = os.getenv('DASHSCOPE_API_KEY', '')
                    self.keys = [default_key] if default_key else []
        
        # 构建 KEY ID 到 KEY 的映射，用于状态轮询时恢复相同KEY
        self._key_id_map = {}
        for key in self.keys:
            key_id = self._generate_key_id(key)
            self._key_id_map[key_id] = key
        
        if self.keys:
            print(f"[KeyManager] Loaded {len(self.keys)} API keys")
            for key in self.keys:
                print(f"  - {key[:12]}...{key[-4:]} (ID: {self._generate_key_id(key)})")
        else:
            print("[KeyManager] WARNING: No API keys loaded!")

    def _generate_key_id(self, key: str) -> str:
        """生成KEY的唯一ID (hash前8位)，用于存储和查找"""
        return hashlib.sha256(key.encode('utf-8')).hexdigest()[:8]

    def get_random_key(self) -> tuple[str | None, str | None]:
        """
        随机获取一个Key
        Returns: (api_key, key_id) 元组
        """
        if not self.keys:
            return None, None
        key = random.choice(self.keys)
        key_id = self._generate_key_id(key)
        return key, key_id

    def get_next_key(self) -> str | None:
        """
        随机获取下一个Key（兼容旧接口，不返回ID）
        警告: 此方法不返回key_id，不适合需要保持KEY一致性的场景
        """
        key, _ = self.get_random_key()
        return key

    def get_key_by_id(self, key_id: str) -> str | None:
        """
        根据KEY ID获取对应的API Key
        用于状态轮询时保持使用创建任务时的相同KEY
        """
        if not key_id:
            return self.get_next_key()  # 兼容旧数据
        return self._key_id_map.get(key_id)

# 单例实例
key_manager = KeyManager()

