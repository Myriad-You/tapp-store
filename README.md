# Myriad Tapp Store

官方 **远程 Tapp 目录**，以静态 Git 仓库托管。Myriad 实例通过商店源 URL 拉取 `index.json`，再按 `download` 与 `manifest.assets` 安装应用。

| 项 | 值 |
| -- | -- |
| 目录 URL（Myriad 预置官方源） | `https://raw.githubusercontent.com/Myriad-You/tapp-store/main/index.json` |
| `base_url` | `https://raw.githubusercontent.com/Myriad-You/tapp-store/main` |
| Myriad 权威文档 | [Tapp 商店](https://github.com/Myriad-You/Myriad/blob/preview/docs/development/tapp/STORE.md) · [Tapp 开发索引](https://github.com/Myriad-You/Myriad/blob/preview/docs/development/TAPP_DEVELOPMENT.md) |

> **开发/运行时契约以 Myriad 主仓库为准。** 本仓库的 `development/` 为面向商店贡献者的镜像与摘要，可能滞后；冲突时以 Myriad `docs/development/tapp/` 为准。
>
> 新 3D 包请声明 `runtimeModules: ["three"]`，不要把 Three 打进商店包。新联机包用 `Tapp.game`（`game:session` + 联邦权限）。已上架的五子棋 / 斗地主仍走普通房间自定义 `message_type`，在未声明 `game` 时保持兼容。

## 在 Myriad 中使用

1. 新实例迁移会预置上述官方源（`official=true`）。
2. 管理员也可在 Tapp Store 设置中添加第三方目录 URL（须指向可公开 GET 的 `index.json`）。
3. 用户在商店 UI 浏览列表（浏览器直连索引）；安装时优先由 **后端** 出站下载，失败或大包时回退为浏览器下载 + direct 安装。

细节见 Myriad [STORE.md](https://github.com/Myriad-You/Myriad/blob/preview/docs/development/tapp/STORE.md)。

## 仓库结构

```text
tapp-store/
├── index.json              # 目录入口（由脚本从 manifest 对齐；PR 禁止手改）
├── categories.json         # UI 分类元数据（可选；安装权威是 apps[].category）
├── README.md
├── apps/
│   └── {app_id}/
│       ├── manifest.json   # 必需（安装与目录对齐的权威源）
│       ├── catalog.json    # 可选（商店展示：简介 / tags / preview / securityReview）
│       ├── core.js         # 示例 core.entry；实际路径以 Manifest 为准
│       ├── page.html / page.css / widget.css / …
│       ├── assets/         # manifest.assets 二进制
│       ├── i18n/
│       ├── page/           # Page 层入口与其 require 的模块
│       └── README.md
├── scripts/
│   ├── check-pr-scope.mjs  # 单 app / 禁 index / version bump
│   ├── sync-index.mjs      # manifest + catalog.json → index
│   ├── validate-app.mjs    # category / 敏感权限 / catalog
│   └── validate-previews.mjs
├── edge/                   # Cloudflare Workers：全网安装统计（可选部署）
└── development/            # 贡献者文档镜像（见下）
```

## 安装统计（边缘，可选）

全网安装次数由 **Cloudflare Workers + KV** 服务维护，**不**写回本仓库 `index.json`（`downloads` 字段仅 schema 占位）。

- 代码与部署说明：[`edge/README.md`](./edge/README.md)
- API：`POST /v1/hit`（安装成功打点）、`GET /v1/stats?apps=…` / `?top=N`
- 默认可部署到 `*.workers.dev`，**不强制自有域名**
- 面向 ~1 万应用：禁止全量 dump、批量 ≤100、top 用维护索引

## `index.json` 协议（摘要）

### 顶层

| 字段 | 说明 |
| ---- | ---- |
| `name` | 商店名称 |
| `version` | 目录版本（元数据）：固定 `1.0.x`，每次有内容变更的合并由 bot 对第三位 +1 |
| `api_version` | 协议提示（当前官方 `"2"`） |
| `base_url` | 解析相对路径的根，无尾斜杠 |
| `updated_at` | ISO 更新时间 |
| `apps` | 应用数组（必需） |
| `maintainer` | 可选 |

### 每个 `apps[]` 条目

| 字段 | 必填 | 说明 |
| ---- | ---- | ---- |
| `id` | ✅ | 与 `manifest.id` 相同 |
| `name` / `version` / `description` | ✅ | 展示；`version` 与 Manifest 同步 |
| `author` | ✅ | `{ name, email?, url? }` |
| `category` | ✅ | 稳定用途 ID（见下）；**必须与 Manifest 一致** |
| `permissions` | ✅ | 申请权限 |
| `download` | ✅ | 相对 `base_url` 的路径表 |
| `locales` | ❌ | BCP-47 → `{ name?, description?, long_description?, preview? }`。`name`/`description` 来自 Manifest；长介绍与预览来自 `catalog.json` |
| `long_description` / `tags` / `icon` / `icon_svg` / `icon_shell` / `theme_color` | ❌ | 展示；`icon_shell: true` 时全彩图标仍套 material 色壳（默认 auto 铺满） |
| `preview` | ❌ | 无脚本静态预览（HTML、CSS、桌面画布与裁切参数） |
| `size` | ❌ | 字节；**≥ 1 MiB 时 Myriad 走客户端下载进度** |
| `featured` / `verified` | ❌ | UI 徽章 |

### `download` 键

| 键 | 说明 |
| -- | ---- |
| `manifest` / `code` | 必需；`code` 指向 `core.entry` |
| `readme` | 可选 |
| `styles` / `widget_styles` / `page_styles` | CSS |
| `page_template` | Page HTML |
| `widget_templates` | `widgetId → { size → path }` |
| `i18n` | `lang → path` |
| `modules` | 非 core 层入口：包内相对路径 → 商店路径 |

**二进制资源不要写入 `download`。** 声明在 `manifest.assets`，安装器拼：

```text
{base_url}/{packageRoot}/{assetPath}
# packageRoot = download.code 的父目录，例如 apps/com.myriad.doudizhu
```

Manifest 若声明了 `page.styles` / `page.template`，索引必须提供对应 `page_styles` / `page_template` 且文件可下载，否则安装失败。

### 分类（稳定 ID）

| ID | 用途 |
| -- | ---- |
| `ai` | AI 应用 |
| `data` | 数据处理与展示 |
| `developer` | 开发工具 |
| `game` | 游戏（注意是 `game` 不是 `games`） |
| `media` | 音频/视频等媒体 |
| `productivity` | 效率 / 笔记 |
| `social` | 社交协作 |
| `utility` | 其他通用工具 |

运行形态（Page / Widget / headless）与 demo/test 阶段用 Manifest 字段或 `tags` 表达，不要塞进 `category`。

### 最小示例

```json
{
  "name": "Example Store",
  "api_version": "2",
  "base_url": "https://raw.githubusercontent.com/org/repo/main",
  "apps": [
    {
      "id": "com.example.notes",
      "name": "Notes",
      "version": "1.0.0",
      "description": "Notes Tapp",
      "author": { "name": "Example" },
      "category": "productivity",
      "permissions": ["storage:read", "storage:write", "widget:register"],
      "download": {
        "manifest": "apps/com.example.notes/manifest.json",
        "code": "apps/com.example.notes/core.js",
        "modules": { "page/index.js": "apps/com.example.notes/page/index.js" }
      }
    }
  ]
}
```

## 贡献应用

> **禁止在 PR 中手改 `index.json`。**  
> **一次 PR 只能修改一个 `apps/<id>/`。** 多应用请拆成多个 PR。  
> 包有实质改动时 **必须 bump `manifest.version`**（纯 README 除外）。  
> 安装相关字段以 `apps/<id>/manifest.json` 为唯一权威；商店展示字段写 `catalog.json`。

1. Fork 本仓库，从 `main` 开分支。
2. **只**在一个 `apps/{id}/` 下添加或修改完整包文件（建议先用仓库内 CLI 或 Myriad [`@myriad-you/tapp-cli`](https://github.com/Myriad-You/Myriad/tree/preview/tools/tapp-cli) 本地 `check` / `pack`）。可附带文档或脚本，但不可夹带第二个 app。
3. 确保 `manifest.id` === 文件夹名；**semver bump**；`category` 使用稳定 ID（见下）。
4. （可选）写 `apps/{id}/catalog.json` 维护商店文案 / tags / preview / `locales` / featured（**不要**改根 `index.json`）。
5. 本地校验：

   ```bash
   node scripts/check-pr-scope.mjs              # 单 app、禁 index、version bump
   node scripts/sync-index.mjs validate --app <id>
   node scripts/validate-app.mjs --app <id>     # category / catalog / 敏感权限
   node tapp-cli/bin/myriad-tapp.mjs check apps/<id> --json
   node scripts/validate-previews.mjs --app <id>
   node scripts/sync-index.mjs report --app <id>  # 信息用；不必手改 index
   ```

6. 提交 Pull Request。
7. 合并后 **Catalog Sync** 自动 `sync` 对齐 `index.json`（manifest + catalog.json → 目录）。

### `catalog.json`（可选，商店展示）

```json
{
  "long_description": "详情长文案",
  "tags": ["标签"],
  "featured": false,
  "verified": false,
  "license": "MIT",
  "preview": {
    "version": 1,
    "type": "snapshot",
    "html": "preview.html",
    "styles": ["page.css", "preview.css"],
    "viewport": { "width": 1440, "height": 900 },
    "fit": "cover",
    "theme": "dark"
  },
  "locales": {
    "en-US": {
      "long_description": "Long description in English.",
      "preview": {
        "version": 1,
        "type": "snapshot",
        "html": "preview.en-US.html",
        "styles": ["preview.css"],
        "viewport": { "width": 1280, "height": 720 },
        "fit": "cover",
        "theme": "light"
      }
    }
  },
  "securityReview": true
}
```

- 路径可写应用内相对路径（`preview.html`），bot 会展开为 `apps/<id>/...`。
- `locales` 只写商店展示层：`long_description` 与 `preview`。标题/短描述仍走 `manifest.locales`。
- 每个语言的 preview 与默认 preview 使用同一套无脚本校验。缺少某语言时，Myriad 回退到默认长介绍/预览。
- 第三方 app 若声明联邦 / 平台 / 管理类**敏感权限**，必须经维护者审阅后在 `catalog.json` 写 `"securityReview": true`，否则 CI 失败。
- `com.myriad.*` 官方应用豁免 `securityReview`。

### 稳定 `category`

`ai` · `data` · `developer` · `game` · `media` · `productivity` · `social` · `utility`  

禁止新包使用 `games` / `tools` / `music` 等别名（CI 会拒绝）。

### PR 流程（CI）

| 阶段 | 行为 |
| ---- | ---- |
| PR | `index.json` 出现在 diff → **失败** |
| PR | 变更 **超过 1 个** `apps/<id>` → **失败** |
| PR | 非文档改动但 **未升高** `manifest.version` → **失败** |
| PR | `validate-app`：规范 category、catalog 形态、敏感权限 |
| PR | 仓库内 `myriad-tapp check`：契约 / 资源 / 权限 |
| PR | dry-run `sync-index` 后校验 preview（含新 app 磁盘预览） |
| 合并到 `main` | Catalog Sync 串行 `sync --prune` 并推送 `index.json` |

### 谁改什么

| 内容 | 谁维护 | 位置 |
| ---- | ------ | ---- |
| 应用代码与 `manifest.json` | 贡献者 | `apps/<id>/` |
| 商店展示（简介、tags、preview、featured…） | 贡献者 | `apps/<id>/catalog.json`（可选） |
| 目录对齐字段（version、category、permissions、download、size…） | **bot** | `index.json`（禁止手改） |

维护者本地对齐：

```bash
node scripts/sync-index.mjs sync
node scripts/sync-index.mjs check
node scripts/validate-app.mjs --all
```

### 发布检查清单

- [ ] **只改了一个** `apps/<id>/`
- [ ] **未** 修改 `index.json`
- [ ] 非文档改动已 **bump** `manifest.version`
- [ ] `category` 为规范 ID
- [ ] `download.code` 与 `manifest.core.entry` 指向同一份文件
- [ ] Manifest 声明的 page/widget 资源均在包内
- [ ] 敏感权限已通过审阅（`catalog.securityReview` 或官方 id）
- [ ] 下列命令通过：`check-pr-scope` / `validate-app` / `myriad-tapp check` / `validate-previews`

### 维护者：分支保护（建议）

在 GitHub → Settings → Branches → `main`：

- Require a pull request before merging  
- Require status checks：`Catalog & package check`  
- Restrict direct pushes（至少非管理员）  

Catalog Sync 使用 `GITHUB_TOKEN` 回写 `index.json`；若开启「禁止 bot 推送」，需改用可写的 deploy key / App token。

## 开发者文档

| 路径 | 说明 |
| ---- | ---- |
| [development/TAPP_DEVELOPMENT.md](./development/TAPP_DEVELOPMENT.md) | 文档索引与 Myriad 链接 |
| [development/tapp/STORE.md](./development/tapp/STORE.md) | 商店协议全文（与 Myriad 同步） |
| [development/tapp/](./development/tapp/) | Manifest / SDK / 沙箱等镜像 |

完整运行时与后端边界请读 Myriad 主仓库文档，不要仅依赖本镜像。

## 许可证

MIT License
