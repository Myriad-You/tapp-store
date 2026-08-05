# tapp-store-stats（Cloudflare Workers）

官方 Tapp 商店的 **安装次数** 统计边缘服务。可独立部署到 Cloudflare，不依赖 Myriad Postgres，也不改写仓库里的 `index.json`。

| 项 | 值 |
| -- | -- |
| 运行时 | Cloudflare Workers |
| 存储 | Workers KV（计数 + 去重 + 限流 + catalog 白名单） |
| 默认入口 | `https://tapp-store-stats.<account>.workers.dev`（**不需要自有域名**） |
| 可选正式域名 | `store-stats.myriad.you` 等（CF 托管 zone 后绑 route） |

## API

### `GET /health`

```json
{ "ok": true, "service": "tapp-store-stats", "version": "1" }
```

### `POST /v1/hit`

安装/更新 **成功后** 由 Myriad 后端或浏览器 fallback 调用（失败不影响安装）。

```json
{
  "app_id": "com.myriad.music-player",
  "version": "1.0.0",
  "event": "install",
  "idempotency_key": "unique-per-install-session",
  "client": "myriad-backend"
}
```

响应：

```json
{ "ok": true, "counted": true, "downloads": 1, "installs": 1, "updates": 0 }
```

- `downloads` ≡ `installs`（与 `index.json` 字段名对齐）
- 同一 `idempotency_key` 在 48h 内只计一次（`counted: false`）
- 默认只接受 **官方 catalog 白名单** 中的 `app_id`（定时从 `CATALOG_URL` 拉取）

### `GET /v1/stats`（10k 规模友好）

**禁止** 无参全量 dump（万级应用时响应过大）。必须：

| 查询 | 含义 | 上限 |
|------|------|------|
| `?apps=id1,id2` | 批量 | 默认 100 |
| `?app=id` | 单应用 | — |
| `?top=20` | 安装量排行（维护中的 top 索引，不扫全库） | 默认 100 |

```bash
curl 'https://tapp-store-stats.example.workers.dev/v1/stats?apps=com.myriad.music-player'
curl 'https://tapp-store-stats.example.workers.dev/v1/stats?top=10'
```

```json
{
  "updated_at": "2026-08-05T12:00:00.000Z",
  "apps": {
    "com.myriad.music-player": {
      "installs": 42,
      "updates": 3,
      "downloads": 42
    }
  }
}
```

`Cache-Control: public, max-age=60`。

## 为何能扛 ~1 万应用

| 路径 | 复杂度 |
|------|--------|
| 单次 hit | O(1) KV 读/写（计数键 + 去重键） |
| stats 批量 | O(batch)，batch ≤ 100，并行 get |
| stats top | O(top)，单 KV 维护 top 列表，**不** list 全部 key |
| catalog 白名单 | 整表 JSON 数组缓存在一个 KV value（1 万 id ≈ 数百 KB） |
| 写回 Git | **不做** — 避免 Catalog Sync 与 commit 风暴 |

安装 QPS 是瓶颈，不是「应用个数」。万级 catalog + 中等安装量在 Workers 免费/付费档都足够。

## 本地开发

```bash
cd edge
npm install
npm test
npm run dev
# 另开终端
curl -s http://127.0.0.1:8787/health
curl -s -X POST http://127.0.0.1:8787/v1/hit \
  -H 'content-type: application/json' \
  -d '{"app_id":"com.myriad.music-player","event":"install","idempotency_key":"local-test-001"}'
curl -s 'http://127.0.0.1:8787/v1/stats?app=com.myriad.music-player'
```

本地 `wrangler dev` 使用模拟 KV。若白名单拉不到 GitHub，可临时：

```toml
# wrangler.toml [vars]
ALLOW_UNKNOWN_APPS = "true"
```

## 部署到 Cloudflare

### 1. 登录与创建 KV

```bash
cd edge
npm install
npx wrangler login
npx wrangler kv namespace create tapp-store-stats
npx wrangler kv namespace create tapp-store-stats --preview
```

把输出的 id 填进 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "STATS"
id = "<production id>"
preview_id = "<preview id>"
```

### 2. 部署

```bash
npm run deploy
```

成功后会打印 `workers.dev` URL，例如：

```text
https://tapp-store-stats.<subdomain>.workers.dev
```

**此时不需要自己的域名** 即可给 Myriad 配置：

```bash
# Myriad backend（后续接入）
TAPP_STORE_STATS_URL=https://tapp-store-stats.<subdomain>.workers.dev

# 前端（后续接入）
VITE_TAPP_STORE_STATS_URL=https://tapp-store-stats.<subdomain>.workers.dev
```

### 3.（可选）自定义域名

在 Cloudflare 仪表盘 → Workers → tapp-store-stats → Triggers → Custom Domains，添加例如 `store-stats.myriad.you`（zone 需已接入 CF）。

## 配置（`[vars]`）

| 变量 | 默认 | 说明 |
|------|------|------|
| `CATALOG_URL` | GitHub raw `index.json` | 白名单来源 |
| `ALLOW_UNKNOWN_APPS` | `false` | `true` 时不校验白名单（仅调试） |
| `HIT_RATE_LIMIT_PER_MIN` | `60` | 每 IP 每分钟 hit 上限 |
| `STATS_MAX_BATCH` | `100` | `apps=` 最大个数 |
| `STATS_TOP_MAX` | `100` | `top=` 最大 |
| `CATALOG_IDS_TTL_SEC` | `600` | 白名单缓存秒数 |

## 安全说明（v1）

- 匿名公开写 + 限流 + idempotency + catalog 白名单
- 不存 IP / 用户身份；`CF-Connecting-IP` 仅用于限流键哈希
- **不是** 审计级防刷；展示文案用「安装次数」即可
- Stats 宕机不得影响 Myriad 安装（客户端 fire-and-forget）

## 与商店协议的关系

- Git `index.json` 的 `downloads` 字段继续由 Catalog Sync **保留**，但不作为真值写入
- 真值在本边缘服务；Myriad UI 用 `/v1/stats` overlay（见主仓 `docs/development/tapp/STORE.md`）

## 目录

```text
edge/
  src/           Worker 源码
  test/          纯逻辑单测（不依赖 CF 账号）
  wrangler.toml  部署配置
  package.json
```
