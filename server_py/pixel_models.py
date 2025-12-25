from sqlalchemy import Column, String, Integer, BigInteger, Text, JSON, Boolean, DateTime, Enum, DECIMAL
from datetime import datetime
try:
    from mysql_config import Base
except ImportError:
    from .mysql_config import Base

class UserProject(Base):
    """用户统一项目记录表 (V2)"""
    __tablename__ = 'user_projects'
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    project_id = Column(String(64), unique=True, nullable=False, comment='业务层唯一ID')
    user_id = Column(BigInteger, nullable=False, index=True, comment='用户ID')
    type = Column(String(20), nullable=False, comment='CREATION, EDITING, TEMPLATE')
    status = Column(String(20), nullable=False, default='PENDING', comment='PENDING, PROCESSING, SUCCESS, FAILED')
    
    # 输入数据
    prompt = Column(Text, comment='提示词')
    input_images = Column(JSON, comment='输入图片URL列表')
    template_id = Column(BigInteger, comment='关联模版ID')
    
    # 输出数据
    result_images = Column(JSON, comment='结果图片URL列表')
    
    # 计费与错误
    cost_points = Column(Integer, default=0, comment='消耗积分')
    error_msg = Column(Text, comment='错误信息')
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    def to_dict(self):
        return {
            'id': self.id,
            'project_id': self.project_id,
            'user_id': self.user_id,
            'type': self.type,
            'status': self.status,
            'prompt': self.prompt,
            'input_images': self.input_images,
            'template_id': self.template_id,
            'result_images': self.result_images,
            'cost_points': self.cost_points,
            'error_msg': self.error_msg,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class BusinessPromptStyleTemplate(Base):
    """业务风格模版表 (V2)"""
    __tablename__ = 'business_prompt_style_template'
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    template_code = Column(String(50), unique=True, comment='模版唯一编码')
    name = Column(String(100), nullable=False, comment='模版名称')
    description = Column(Text, comment='模版描述')
    cover_image = Column(String(500), comment='封面图URL')
    example_images = Column(JSON, comment='示例效果图列表')
    category = Column(String(50), default='2025_trend', comment='分类')
    tags = Column(JSON, comment='标签列表')
    
    # 工作流配置
    workflow_id = Column(String(100), comment='ComfyUI Workflow ID')
    workflow_config = Column(JSON, comment='工作流详细配置')
    default_prompt = Column(Text, comment='默认提示词')
    default_negative_prompt = Column(Text, comment='默认负向提示词')
    
    # 用户输入配置
    user_input_config = Column(JSON, comment='用户输入规则') # {required: true, image_count: 1}
    
    # 业务属性
    points_cost = Column(Integer, default=1, comment='积分消耗')
    is_vip = Column(Boolean, default=False, comment='是否VIP专属')
    status = Column(Enum('active', 'inactive'), default='active', comment='状态')
    sort_order = Column(Integer, default=0, comment='排序权重')
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    def to_dict(self):
        # Get minImages from user_input_config
        min_images = 0
        if self.user_input_config and isinstance(self.user_input_config, dict):
            min_images = self.user_input_config.get('image_count', 0)
        
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'cover_image': self.cover_image,
            'category': self.category,
            'minImages': min_images,
            'has_examples': bool(self.example_images),
            'example_images': self.example_images or [],
            'default_prompt': self.default_prompt,
            'tags': self.tags or [],
            'points_cost': self.points_cost,
            'is_vip': self.is_vip,
            'user_input_config': self.user_input_config
        }

# Simplified User Models (Mapping existing tables)
class UserProfile(Base):
    """用户基础信息表"""
    __tablename__ = 'user_profile'
    __table_args__ = {'schema': 'candy_pixel_user'}
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    phone = Column(String(20), unique=True, nullable=False, comment='手机号')
    password = Column(String(255), nullable=False, default='', comment='密码')
    nick = Column(String(50), default='', comment='昵称')
    avatar = Column(String(500), default='', comment='头像')
    status = Column(Integer, default=1, comment='状态 1正常')
    create_time = Column(DateTime, default=datetime.now)
    modified_time = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    # Ignored other columns for now as they likely have defaults or are nullable

class ThirdPartyAccount(Base):
    """第三方账户表"""
    __tablename__ = 'third_party_accounts'
    __table_args__ = {'schema': 'candy_pixel_user'}
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, nullable=False, index=True)
    open_id = Column(String(64), nullable=False, index=True, comment='第三方唯一ID')
    union_id = Column(String(64), comment='Unified ID')
    extend_info = Column(Text, comment='扩展信息JSON')
    gmt_create = Column(DateTime, default=datetime.now)
    gmt_modified = Column(DateTime, default=datetime.now, onupdate=datetime.now)

class UserTransaction(Base):
    """用户交易记录表 (扣减/充值)"""
    __tablename__ = 'user_transactions'
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, nullable=False, index=True)
    amount = Column(Integer, nullable=False, comment='金额(积分), 负数为扣减')
    type = Column(String(20), nullable=False, comment='RECHARGE, CONSUME, REFUND')
    reason = Column(String(255), comment='原因描述')
    project_id = Column(String(64), nullable=True, comment='关联项目ID')
    balance_after = Column(Integer, comment='变动后余额')
    created_at = Column(DateTime, default=datetime.now)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'amount': self.amount,
            'type': self.type,
            'reason': self.reason,
            'project_id': self.project_id,
            'balance_after': self.balance_after,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class UserBalance(Base):
    """用户余额表"""
    __tablename__ = 'user_balance'
    __table_args__ = {'schema': 'candy_pixel_user'}
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, unique=True, nullable=False)
    balance = Column(Integer, default=0, comment='当前余额') # Mapped as Integer, but DB is Decimal. SQLAlchemy usually handles cast or I should use Numeric. 
    # Use Numeric for correctness
    from sqlalchemy import Numeric
    balance = Column(Numeric(10, 2), default=0)
    frozen_balance = Column(Numeric(10, 2), default=0)
    total_recharge = Column(Numeric(10, 2), default=0)
    total_consume = Column(Numeric(10, 2), default=0)
    create_time = Column(DateTime, default=datetime.now)
    modified_time = Column(DateTime, default=datetime.now, onupdate=datetime.now)
