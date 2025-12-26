#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MySQL数据库配置模块 - 专用于miniz-service的AIGC相关功能
使用 yhlz_candyai 数据库
"""

import os
from sqlalchemy import create_engine, MetaData, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from urllib.parse import quote_plus
import logging

# 日志配置
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 允许通过环境变量直接指定数据库URL（优先级最高）
# 支持示例：
#   mysql+pymysql://user:pass@host:3306/affect_lab?charset=utf8mb4
ENV_DATABASE_URL = os.environ.get('DATABASE_URL')

# MySQL 配置（仅在未显式提供 DATABASE_URL 时使用）
MYSQL_HOST = os.getenv('MYSQL_HOST', '127.0.0.1')
MYSQL_PORT = int(os.getenv('MYSQL_PORT', 3306))
MYSQL_USER = os.getenv('MYSQL_USER', 'root')
MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', '')
MYSQL_DATABASE = os.getenv('MYSQL_DATABASE', 'affect_lab')

# URL Encode Password
encoded_password = quote_plus(MYSQL_PASSWORD)

# Preferred DB URL
PREFERRED_DB_URL = f'mysql+pymysql://{MYSQL_USER}:{encoded_password}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}?charset=utf8mb4'
EFFECTIVE_DB_URL = ENV_DATABASE_URL or PREFERRED_DB_URL

try:
    engine = create_engine(
        EFFECTIVE_DB_URL,
        pool_pre_ping=True,
        pool_recycle=3600,
        pool_size=5,
        max_overflow=10,
        echo=False
    )
    # Test Connection
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    try:
        logger.info(f"✓ 已连接到数据库: {engine.url.render_as_string(hide_password=True)}")
    except Exception:
        logger.info("✓ 已连接到数据库")
except Exception as e:
    logger.error(f"✗ 无法连接到MySQL数据库: {e}")
    # CRITICAL: Do NOT fall back to SQLite
    raise e

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# 创建Base类
Base = declarative_base()


def _migrate_schema():
    """对已存在的表进行轻量迁移（仅添加缺失字段，不做破坏性变更）"""
    try:
        db_name = getattr(engine.url, 'database', None)
        if not db_name:
            logger.info("未检测到MySQL数据库名，跳过迁移（可能为SQLite环境）")
            return
        with engine.connect() as conn:
            # 仅对business_meta表做兼容性补全
            result = conn.execute(text(
                """
                SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'business_meta'
                """
            ), {"db": db_name})
            existing_cols = {row[0] for row in result.fetchall()}

            alter_sqls = []
            if 'comfyui_workflow_json' not in existing_cols:
                alter_sqls.append("ALTER TABLE business_meta ADD COLUMN comfyui_workflow_json JSON NULL")
            if 'api_chain' not in existing_cols:
                alter_sqls.append("ALTER TABLE business_meta ADD COLUMN api_chain JSON NULL")
            if 'points_cost' not in existing_cols:
                alter_sqls.append("ALTER TABLE business_meta ADD COLUMN points_cost INT DEFAULT 1")
            if 'keywords' not in existing_cols:
                alter_sqls.append("ALTER TABLE business_meta ADD COLUMN keywords JSON NULL")
            if 'description' not in existing_cols:
                alter_sqls.append("ALTER TABLE business_meta ADD COLUMN description TEXT NULL")
            # 新增高级模板相关字段
            if 'comfyui_workflow_id' not in existing_cols:
                alter_sqls.append("ALTER TABLE business_meta ADD COLUMN comfyui_workflow_id VARCHAR(100) NULL")
            if 'preview_image_url' not in existing_cols:
                alter_sqls.append("ALTER TABLE business_meta ADD COLUMN preview_image_url VARCHAR(500) NULL")
            if 'is_for_sale' not in existing_cols:
                alter_sqls.append("ALTER TABLE business_meta ADD COLUMN is_for_sale TINYINT(1) DEFAULT 0")
            if 'tags' not in existing_cols:
                alter_sqls.append("ALTER TABLE business_meta ADD COLUMN tags VARCHAR(500) NULL")
            if 'sort_order' not in existing_cols:
                alter_sqls.append("ALTER TABLE business_meta ADD COLUMN sort_order INT DEFAULT 0")
            # 新增时间字段，兼容ORM模型
            if 'created_at' not in existing_cols:
                alter_sqls.append("ALTER TABLE business_meta ADD COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP")
            if 'updated_at' not in existing_cols:
                alter_sqls.append("ALTER TABLE business_meta ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
            
            for sql in alter_sqls:
                try:
                    conn.execute(text(sql))
                    logger.info(f"✓ 执行模式迁移: {sql}")
                except Exception as e:
                    logger.error(f"✗ 模式迁移失败: {sql} -> {e}")

            # 对 jobs 表进行兼容性补全/扩容
            try:
                result = conn.execute(text(
                    """
                    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'jobs'
                    """
                ), {"db": db_name})
                jobs_cols = {row[0]: {"type": row[1], "length": row[2]} for row in result.fetchall()}

                jobs_alter_sqls = []
                # image_data 扩容为 MEDIUMTEXT（默认 TEXT 约 64KB，可能不够）
                if 'image_data' in jobs_cols:
                    img_type = (jobs_cols['image_data']['type'] or '').lower()
                    if img_type not in ('mediumtext', 'longtext'):
                        jobs_alter_sqls.append("ALTER TABLE jobs MODIFY COLUMN image_data MEDIUMTEXT NULL")

                # user_token 扩容到 1024（JWT 往往超过 255）
                if 'user_token' in jobs_cols:
                    tok_type = (jobs_cols['user_token']['type'] or '').lower()
                    tok_len = jobs_cols['user_token']['length'] or 0
                    if (tok_type == 'varchar' and tok_len < 1024) or tok_type in ('tinytext', 'text'):
                        jobs_alter_sqls.append("ALTER TABLE jobs MODIFY COLUMN user_token VARCHAR(1024) NULL")

                for sql in jobs_alter_sqls:
                    try:
                        conn.execute(text(sql))
                        logger.info(f"✓ 执行模式迁移: {sql}")
                    except Exception as e:
                        logger.error(f"✗ 模式迁移失败: {sql} -> {e}")
            except Exception as e:
                logger.error(f"✗ jobs 表模式迁移检查失败: {e}")


            # business_style_template 兼容性补全保留
            try:
                result = conn.execute(text(
                    """
                    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'business_style_template'
                    """
                ), {"db": db_name})
                style_cols = {row[0] for row in result.fetchall()}

                style_alter_sqls = []
                if 'template_intro' not in style_cols:
                    style_alter_sqls.append("ALTER TABLE business_style_template ADD COLUMN template_intro TEXT NULL COMMENT '模版简介'")
                if 'effect_images' not in style_cols:
                    style_alter_sqls.append("ALTER TABLE business_style_template ADD COLUMN effect_images JSON NULL COMMENT '模版效果图列表'")
                
                for sql in style_alter_sqls:
                    try:
                        conn.execute(text(sql))
                    except Exception:
                        pass
            except Exception:
                pass

            # [NEW] business_prompt_style_template 表创建 (V2)
            try:
                table_exists = conn.execute(text(
                    """
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'business_prompt_style_template'
                    """
                ), {"db": db_name}).scalar() > 0

                if not table_exists:
                    create_tpl_sql = """
                    CREATE TABLE IF NOT EXISTS business_prompt_style_template (
                        id BIGINT AUTO_INCREMENT PRIMARY KEY,
                        template_code VARCHAR(50) UNIQUE NULL COMMENT '模版唯一编码',
                        name VARCHAR(100) NOT NULL COMMENT '模版名称',
                        description TEXT COMMENT '模版描述/简介',
                        cover_image VARCHAR(500) COMMENT '封面图 URL',
                        example_images JSON COMMENT '示例效果图列表',
                        category VARCHAR(50) DEFAULT '2025_trend' COMMENT '分类',
                        tags JSON COMMENT '标签列表',
                        workflow_id VARCHAR(100) COMMENT 'ComfyUI Workflow ID / Model Name',
                        workflow_config JSON COMMENT '工作流配置',
                        default_prompt TEXT COMMENT '默认提示词',
                        default_negative_prompt TEXT COMMENT '默认负向提示词',
                        user_input_config JSON COMMENT '用户输入配置',
                        points_cost INT DEFAULT 1 COMMENT '积分消耗',
                        is_vip TINYINT(1) DEFAULT 0 COMMENT '是否VIP专属',
                        status ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态',
                        sort_order INT DEFAULT 0 COMMENT '排序权重',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
                        INDEX idx_category (category),
                        INDEX idx_status (status)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                    """
                    conn.execute(text(create_tpl_sql))
                    logger.info("✓ 创建 business_prompt_style_template 表成功")
            except Exception as e:
                logger.error(f"✗ business_prompt_style_template 表创建失败: {e}")

            # 检查 user_projects 表是否需要创建
            try:
                # 检查表是否存在
                table_exists = conn.execute(text(
                    """
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'user_projects'
                    """
                ), {"db": db_name}).scalar() > 0

                if not table_exists:
                    create_project_table_sql = """
                    CREATE TABLE IF NOT EXISTS user_projects (
                        id BIGINT AUTO_INCREMENT PRIMARY KEY,
                        project_id VARCHAR(64) UNIQUE NOT NULL COMMENT '业务层唯一ID',
                        user_id BIGINT NOT NULL COMMENT '用户ID',
                        type VARCHAR(20) NOT NULL COMMENT 'CREATION, EDITING, TEMPLATE',
                        status VARCHAR(20) NOT NULL COMMENT 'PENDING, PROCESSING, SUCCESS, FAILED',
                        prompt TEXT COMMENT '提示词',
                        input_images JSON COMMENT '输入图片URL列表',
                        template_id BIGINT COMMENT '关联模版ID',
                        result_images JSON COMMENT '结果图片URL列表',
                        cost_points INT DEFAULT 0 COMMENT '消耗积分',
                        error_msg TEXT COMMENT '错误信息',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
                        INDEX idx_user_id (user_id),
                        INDEX idx_project_id (project_id)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                    """
                    conn.execute(text(create_project_table_sql))
                    logger.info("✓ 创建 user_projects 表成功")
            except Exception as e:
                logger.error(f"✗ user_projects 表创建检查失败: {e}")

            # 对 user_balance 表进行兼容性补全 (添加 project_id 关联支持? 实际上 balance 表可能不需要改，而是记录表)
            # 不过技术方案提到 "积分表增加 project_id 关联"，但积分表通常是余额，应该是流水表增加。
            # 假设目前Miniz的扣费记录没有单独表，或者在 user_server 的 balance_log 里。
            # 这里先不改 user_balance 表结构，以免破坏 user-server 逻辑，主要通过 user_projects 记录。
            
    except Exception as e:
        logger.error(f"✗ 模式迁移检查失败: {e}")


def get_db():
    """获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db_session():
    """获取数据库会话（非生成器版本）"""
    return SessionLocal()


def init_database():
    """初始化数据库 - 创建所有表"""
    try:
        # 测试连接
        with engine.connect() as connection:
            logger.info(f"✓ 成功连接到数据库: {EFFECTIVE_DB_URL}")
        # 延迟导入，避免循环依赖
        try:
            from models import BusinessMetaModel, StylePresetModel, PromptTemplateModel, JobModel  # noqa: F401
        except ImportError:
            logger.warning("models module not found, skipping specific model imports")
        # 创建所有表
        Base.metadata.create_all(bind=engine)
        # 运行轻量级迁移，补充缺失字段
        _migrate_schema()
        logger.info("✓ 数据库表初始化完成")
        return True
    except Exception as e:
        logger.error(f"✗ 数据库初始化失败: {str(e)}")
        return False


def test_connection():
    """测试数据库连接"""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            logger.info("✓ 数据库连接测试成功")
            return True
    except Exception as e:
        logger.error(f"✗ 数据库连接测试失败: {str(e)}")
        return False


if __name__ == "__main__":
    print("测试数据库连接...")
    print(f"数据库URL: {EFFECTIVE_DB_URL}")
    test_connection()
