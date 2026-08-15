# Myriad 安装配置生成

生成生产用 `docker-compose.yml`、`.env`、Nginx 与部署说明。

## 版本

`1.0.4`

## 安全

- **密钥白名单**：`JWT_SECRET` / `UPDATE_TOKEN` / `UPDATER_GATEWAY_SECRET` / `MYRIAD_SETUP_SECRET`（及 bundled `POSTGRES_PASSWORD`）须匹配 `[A-Za-z0-9_-]{32,512}`；拒绝 CR/LF/NUL、`#`、`=`、空白，避免未加引号 `.env` 注入。
- **安装暗号**：`MYRIAD_SETUP_SECRET` 写入 `.env` 并注入 backend。生成页和结果区都会提醒先复制，首次向导创建所有者必须对上。
- **生成后自检**：对产物再 `parseDotenvStrict`，校验密钥一致、期望键齐全、`PROXY_ALLOW_DIRECT_UPDATER=false` 仅一次。
- **Nginx 上传**：≤512KB、`.conf`/文本、拒 NUL。
- **Docker Hub**：`Promise.allSettled`，单仓失败不拖垮；优先四组件共同 versioned tag。
- **资源边界**：内存 16M–256G；PostgreSQL 主版本 18–20。
- **Digest**：tag 可写 `vX.Y.Z@sha256:<64hex>`。
- 自检脚本：`node apps/com.myriad.config-generator/scripts/security-smoke.mjs`

## UI

- **自定义下拉**：`select.form-select` 在运行时增强为 `.cg-select`（自绘 trigger + option 列表），跟随壁纸主色/深色模式；原生 `<select>` 仅作值载体（系统 option 菜单无法主题化）。

## 面板适配（用户可选）

| 面板 | Compose 用法 | 站点路径（默认 conf） | 日志 | 依据 |
|------|--------------|----------------------|------|------|
| **1Panel** | 编排粘贴 YAML；环境变量框粘贴 `.env` | `/www/sites/<domain>/index` | `/www/sites/<domain>/log/…` | 1Panel 编排文档 + 本生成器历史默认 |
| **宝塔** | **也可「创建编排」粘贴 YAML**（官方教程）；或目录+终端；应用商店编排常改同目录 `.env` | `/www/wwwroot/<domain>` | `/www/wwwlogs/<domain>.log` | 站点 conf 默认（论坛示例）；Compose [140412](https://www.bt.cn/bbs/thread-140412-1-1.html)；`.env` 端口 [141215](https://www.bt.cn/bbs/thread-141215-1-1.html)；`.env` 未加载 [124845](https://www.bt.cn/bbs/thread-124845-1-1.html) |
| **通用 / CLI** | `docker compose up -d` | `/var/www/<domain>/html` | `/var/log/nginx/…` | 常规 Linux 约定 |

### 数据库权限（用户反馈 · Docker 通病，宝塔更易触发）

公开案例形态：`wrong ownership`、`Permission denied` / `Operation not permitted` on postgresql data dir（Docker Hub issue / SO / 论坛，不限宝塔）。  
根因：bind mount 目录须由容器内 **系统用户 postgres** 拥有。本仓库 `postgres:*-alpine` **实测 `uid=70`**（Debian 系常见 999，勿混）。  
宝塔「文件」root 建目录易踩；另有**软件商店原生 PG**（`/www/server/pgsql`）权限线，与 Myriad compose 内置库无关。  
DEPLOY：`chown -R 70:70 pgdata && chmod 700 pgdata`。

## 输出

| 文件 | 内容 |
|------|------|
| `docker-compose.yml` | proxy / frontend / backend / backend-volume-init / [postgres] / docker-guard / updater / updater-gateway |
| `.env` | 密钥、tag、`MYRIAD_DB_MODE`（勿提交） |
| `<domain>.conf` | 外层整站反代到 proxy（含 ACME 本地挑战） |
| `DEPLOY.md` | 启动、联邦与救援（含所选面板专章） |

## 数据库模式 `MYRIAD_DB_MODE`

| 模式 | 说明 |
|------|------|
| `bundled`（默认） | compose 含 `postgres` 服务、`./pgdata`、`depends_on: service_healthy`；`DATABASE_URL` 指向 `postgres:5432`；updater 可快照 pgdata |
| `external` | **不**生成 `postgres` 服务；backend **不** `depends_on` postgres；`DATABASE_URL` 为用户外置库完整 URL；`DOCKER_GUARD_ALLOWED_IMAGES` 不含 `postgres`；不强制 `mkdir pgdata` / 不设 `UPDATER_PGDATA` |

外置库（1Panel 外部 DB、托管 Postgres 等）选 **外置 Postgres**，避免 updater 重启后再起内置库冲突。

外置数据备份与恢复由运维自行负责；Myriad updater 在 `external` 下**不会**快照数据库。

容器访问宿主机上的库：主机可填 IP、`host.docker.internal`（Docker Desktop）或 docker bridge 网关（如 `172.17.0.1`）。

## 网络

| 网络 | 成员 |
|------|------|
| `myriad-net` | proxy, frontend, backend（bundled 时含 postgres） |
| `myriad-admin-net` | backend, updater, updater-gateway, proxy |
| `myriad-docker-guard-net` (internal) | updater, docker-guard |

- backend-volume-init 使用 `network_mode: none`
- 仅 docker-guard 挂 sock；仅 proxy 映射宿主端口
- `DOCKER_GUARD_ALLOWED_IMAGES` 须含 backend / frontend / **proxy** / updater；（bundled 时另含 postgres；漏 proxy 会导致 pull 403）
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

1. 选择面板（1Panel / 宝塔 / 通用）  
2. 填域名 / 数据库（内置或外置），确认密钥  
3. 可选上传 Nginx 站点配置（会规范为整站反代 + ACME 本地挑战）  
4. 生成并下载  

**1Panel：** YAML → 编排，`.env` → 环境变量。  
**宝塔：** 目录内同时放 compose + `.env` → Docker 容器编排添加项目；网站反向代理目标 `127.0.0.1:HTTP_PORT`，代理 `/`。  
站点反代均到 `HTTP_BIND_ADDRESS:HTTP_PORT`。

**内置：**

```bash
mkdir -p pgdata state backups
chmod 600 .env
docker compose up -d
```

**外置：**（无需 `pgdata`）

```bash
mkdir -p state backups
chmod 600 .env
docker compose up -d
```

可选：`scripts/docker/deploy.sh up`。

## 注意

- 勿公开 `.env`
- 仅 proxy 映射宿主端口（`HTTP_BIND_ADDRESS` 默认本机绑定，适配面板 Nginx 反代）
- cosign=`off` 时需双钥匙（见生成的 `.env`）
- `PROXY_TRUSTED_UPSTREAMS` 空=信任私网/回环上游；切勿 `0.0.0.0/0`
- 外置模式下数据库备份不由 Myriad updater 负责
