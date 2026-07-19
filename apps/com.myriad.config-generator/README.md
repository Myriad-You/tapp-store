# Myriad 安装配置生成

生成生产用 `docker-compose.yml`、`.env`、Nginx 与部署说明。

## 输出

| 文件 | 内容 |
|------|------|
| `docker-compose.yml` | proxy / frontend / backend / backend-volume-init / postgres / docker-guard / updater / updater-gateway |
| `.env` | 密钥与 tag（勿提交） |
| `<domain>.conf` | 外层整站反代到 proxy（含 ACME 本地挑战） |
| `DEPLOY.md` | 启动、联邦与救援 |

## 网络

| 网络 | 成员 |
|------|------|
| `myriad-net` | proxy, frontend, backend, postgres |
| `myriad-admin-net` | backend, updater, updater-gateway, proxy |
| `myriad-docker-guard-net` (internal) | updater, docker-guard |

- backend-volume-init 使用 `network_mode: none`
- 仅 docker-guard 挂 sock；仅 proxy 映射宿主端口
- backend 只持 `UPDATER_GATEWAY_SECRET`，经 gateway 更新
- backend-volume-init 会在 backend 启动前修复持久卷权限
- 禁止 `:latest`

## 联邦 / Federation

外层反代必须 **整站** 指向 Myriad proxy，**不要只反代 `/api`**（否则 WebFinger/inbox 联邦会挂）。

| 配置 | 说明 |
|------|------|
| `BASE_URL` / `FRONTEND_URL` | 公网 HTTPS 源站，用于 Actor URL；联邦必填 |
| `PROXY_TAG` | 与 `MYRIAD_TAG` 独立；proxy 有 AP 路由变更时单独 bump |
| 外层 Nginx | `location /` → proxy；`/.well-known/acme-challenge/` 本地；其余 `.well-known` 走 proxy |

必须到达 proxy 的路径：

- `/.well-known/webfinger`
- `/.well-known/nodeinfo`
- `/nodeinfo/2.1`
- `/inbox`
- `/users/`
- `/api/*`（含联邦 WebSocket `/api/federation/*/ws`）

冒烟（期望 JSON，不是 HTML）：

```bash
curl -sS "https://YOUR_DOMAIN/.well-known/webfinger?resource=acct:USER@YOUR_DOMAIN" | head -c 200
curl -sS "https://YOUR_DOMAIN/.well-known/nodeinfo" | head -c 200
```

## 用法

1. 填域名 / 数据库，确认密钥  
2. 可选上传 Nginx 站点配置（会规范为整站反代 + ACME 本地挑战）  
3. 生成并下载  

1Panel：YAML → 编排，`.env` → 环境变量；站点反代到 `HTTP_BIND_ADDRESS:HTTP_PORT`。

```bash
mkdir -p pgdata state backups
chmod 600 .env
docker compose up -d
```

可选：`scripts/docker/deploy.sh up`。

## 注意

- 勿公开 `.env`
- 仅 proxy 映射宿主端口（`HTTP_BIND_ADDRESS` 默认本机绑定，适配 1Panel）
- cosign=`off` 时需双钥匙（见生成的 `.env`）
- `PROXY_TRUSTED_UPSTREAMS` 空=信任私网/回环上游；切勿 `0.0.0.0/0`
