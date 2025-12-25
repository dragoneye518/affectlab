# 使用官方 Python 3.10 轻量级镜像
FROM python:3.10-slim

# 设置环境变量
# 防止 Python 生成 .pyc 文件
ENV PYTHONDONTWRITEBYTECODE=1
# 确保日志直接输出到控制台，不缓存
ENV PYTHONUNBUFFERED=1
# 设置时区为上海
ENV TZ=Asia/Shanghai

# 设置工作目录
WORKDIR /app

# 1. 先只复制依赖文件，利用 Docker 缓存层加速构建
COPY requirements.txt .

# 2. 安装依赖 (使用清华源加速国内下载)
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 3. 复制其余代码文件
COPY . .

# 暴露端口 (仅用于文档说明，实际端口映射在 docker run 中指定)
EXPOSE 12016

# 启动命令
# 使用 uvicorn 直接启动 FastAPI 应用
# host 0.0.0.0 允许外部访问
# port 12016 对应容器内部端口
CMD ["uvicorn", "pixel_aigc_server:app", "--host", "0.0.0.0", "--port", "12016"]
