# Myriad 安装配置生成器

一键生成 Myriad 部署所需的配置文件。

## 功能

- **Docker Compose 配置**：自动生成包含 PostgreSQL、Backend、Frontend 的完整配置
- **Nginx 配置**：生成主域名和 API 域名的反向代理配置
- **安全密钥生成**：自动生成强随机数据库密码和 JWT 密钥
- **SSL 配置保留**：上传现有 Nginx 配置后，保留原有 SSL 设置，仅替换域名

## 使用方法

1. 填写您的主域名（如 `example.com`）和 API 域名（如 `api.example.com`）
2. 点击生成按钮自动生成数据库密码和 JWT 密钥
3. (可选) 上传您现有的 Nginx 配置文件以保留 SSL 设置
4. 点击"生成配置文件"按钮
5. 复制或下载生成的配置文件

## 生成的配置文件

### docker-compose.yml

包含以下服务：
- PostgreSQL 16 数据库（含性能优化配置）
- Myriad Backend API
- Myriad Frontend

### Nginx 配置

- **主域名配置**：前端静态文件服务 + API 代理
- **API 域名配置**：后端 API 反向代理（含 WebSocket 支持）

## 注意事项

- 生成的密码包含特殊字符，已自动进行 URL 编码处理
- 如果不上传 Nginx 配置，将生成不含 SSL 的基础配置
- 上传现有配置时，会保留原有的 SSL 证书路径和相关设置
