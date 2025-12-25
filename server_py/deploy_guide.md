# CandyPixel 后端部署指南 (腾讯云 Docker 版)

本指南适用于手动控制 Docker 容器 (`docker container start`) 的场景。
考虑到国内网络环境和依赖包安装问题，我们将**在服务器上构建镜像**（利用国内源加速）。

## 1. 准备工作

请确保本地代码已清理，并包含以下新生成的关键文件：
*   `Dockerfile`: 用于构建镜像。
*   `.dockerignore`: 排除不必要文件。
*   `.env.example`: 环境变量模板。
*   `scripts/`: 管理脚本目录。

## 2. 打包与上传

由于 `__pycache__` 和本地虚拟环境 (`venv`) 与 Linux 服务器不兼容，请**不要**直接上传整个文件夹。

### 步骤 2.1: 本地打包 (Mac)
在 `server_py` 的**上级目录** (`/Users/zhumingjun/ai/CandyImagenAI`) 执行：

```bash
# 进入项目根目录
cd /Users/zhumingjun/ai/CandyImagenAI

# 打包 server_py 目录 (排除杂项)
zip -r candy_backend.zip server_py -x "server_py/venv/*" "server_py/__pycache__/*" "server_py/*/__pycache__/*" "server_py/*.log" "server_py/.git/*" "server_py/.DS_Store"
```

### 步骤 2.2: 上传到腾讯云
使用 `scp` 或您的 FTP 工具上传 `candy_backend.zip` 到服务器（例如 `/root/` 目录）。

```bash
# 示例 scp 命令
scp candy_backend.zip root@您的服务器IP:/root/
```

## 3. 服务器端部署

登录到您的腾讯云服务器进行操作。

### 步骤 3.1: 解压与配置

```bash
# 进入上传目录
cd /root/

# 解压 (如果提示 command not found，请先安装 unzip: yum install unzip)
unzip -o candy_backend.zip

# 进入代码目录
cd server_py

# 复制配置文件
cp .env.example .env

# === 关键步骤 ===
# 编辑 .env 文件，填入真实的 MySQL 地址、密码、OSS Key 等
vi .env
```
*注意：`MYSQL_HOST` 如果是云数据库，请填写内网地址；如果是本机 Docker MySQL，请填写宿主机 IP 或容器网络别名。*

### 步骤 3.2: 构建镜像 (Build)

这一步会下载 Python 环境并安装依赖（已配置清华源加速）。

```bash
# 构建镜像，命名为 candy-backend
docker build -t candy-backend .
```

### 步骤 3.3: 启动容器 (Run)

使用 `docker run` 启动，并挂载 `.env` 文件。

```bash
# 停止并删除旧容器 (如果存在)
docker stop candy-backend 2>/dev/null
docker rm candy-backend 2>/dev/null

# 启动新容器
# -d: 后台运行
# --name: 容器名称
# -p 12016:12016: 映射端口 (宿主机:容器)
# --env-file .env: 读取环境变量
# --restart always: 开机自启
docker run -d \
  --name candy-backend \
  --restart always \
  -p 12016:12016 \
  --env-file .env \
  candy-backend
```

## 4. 验证与维护

### 查看日志
```bash
docker logs -f candy-backend
```
如果看到 `Uvicorn running on http://0.0.0.0:12016`，说明启动成功。

### 手动停止/启动
```bash
docker container stop candy-backend
docker container start candy-backend
```

### 更新代码
1. 重新打包上传 `candy_backend.zip`。
2. 解压覆盖。
3. 重新执行 **步骤 3.2 (Build)** 和 **步骤 3.3 (Run)**。

## 常见问题 (Q&A)

**Q: 为什么不用 `python pixel_aigc_server.py` 启动？**
A: `python xxx.py` 通常用于开发环境调试。在生产环境 Docker 中，使用 `uvicorn` 命令启动更加标准和高效，它能更好地处理并发连接和信号管理。我们的 `Dockerfile` 中使用了 `CMD ["uvicorn", ...]`，这正是生产级的启动方式。

**Q: 端口为什么是 12016？**
A: 我们已在 `Dockerfile` 和代码中将默认端口调整为 `12016`。请确保腾讯云**安全组**已放行 `TCP:12016` 端口。
