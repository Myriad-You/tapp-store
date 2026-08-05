# Myriad Tapp Store

官方 **远程 Tapp 目录**，以静态 Git 仓库托管。Myriad 实例通过商店源 URL 拉取 `index.json`，再按 `download` 与 `manifest.assets` 安装应用。

| 项 | 值 |
| -- | -- |
| 目录 URL（Myriad 预置官方源） | `https://raw.githubusercontent.com/Myriad-You/tapp-store/main/index.json` |
| `base_url` | `https://raw.githubusercontent.com/Myriad-You/tapp-store/main` |
| Myriad 权威文档 | [Tapp 商店](https://github.com/Myriad-You/Myriad/blob/preview/docs/development/tapp/STORE.md) · [Tapp 开发索引](https://github.com/Myriad-You/Myriad/blob/preview/docs/development/TAPP_DEVELOPMENT.md) |

> **开发/运行时契约以 Myriad 主仓库为准。** 本仓库的 `development/` 为面向商店贡献者的镜像与摘要，可能滞后；冲突时以 Myriad `docs/development/tapp/` 为准。

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
│       ├── main.js         # 入口（或 index.js 等，与 manifest.main 一致）
│       ├── page.html / page.css / widget.css / …
│       ├── assets/         # manifest.assets 二进制
│       ├── i18n/
│       ├── page/           # pageModules
│       └── README.md
├── scripts/
│   ├── sync-index.mjs      # manifest ↔ index 对齐 / 校验
│   └── validate-previews.mjs
└── development/            # 贡献者文档镜像（见下）
```

## `index.json` 协议（摘要）

### 顶层

| 字段 | 说明 |
| ---- | ---- |
| `name` | 商店名称 |
| `version` | 目录版本（元数据） |
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
| `locales` | ❌ | BCP-47 → `{ name?, description? }` |
| `long_description` / `tags` / `icon` / `icon_svg` / `icon_shell` / `theme_color` | ❌ | 展示；`icon_shell: true` 时全彩图标仍套 material 色壳（默认 auto 铺满） |
| `preview` | ❌ | 无脚本静态预览（HTML、CSS、桌面画布与裁切参数） |
| `size` | ❌ | 字节；**≥ 1 MiB 时 Myriad 走客户端下载进度** |
| `featured` / `verified` | ❌ | UI 徽章 |

### `download` 键

| 键 | 说明 |
| -- | ---- |
| `manifest` / `code` | 必需 |
| `readme` | 可选 |
| `styles` / `widget_styles` / `page_styles` | CSS |
| `page_template` | Page HTML |
| `widget_templates` | `widgetId → { size → path }` |
| `i18n` | `lang → path` |
| `page_modules` | **安装后文件名** → 商店路径 |

**二进制资源不要写入 `download`。** 声明在 `manifest.assets`，安装器拼：

```text
{base_url}/{packageRoot}/{assetPath}
# packageRoot = download.code 的父目录，例如 apps/com.myriad.doudizhu
```

Manifest 若声明了 `pageStyles` / `pageTemplate`，索引必须提供对应 `page_styles` / `page_template` 且文件可下载，否则安装失败。

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
      "permissions": ["storage", "widget:register"],
      "download": {
        "manifest": "apps/com.example.notes/manifest.json",
        "code": "apps/com.example.notes/main.js"
      }
    }
  ]
}
```

## 贡献应用

> **禁止在 PR 中手改 `index.json`。**  
> **一次 PR 只能修改一个 `apps/<id>/`。** 多应用请拆成多个 PR。  
> 安装相关字段以 `apps/<id>/manifest.json` 为唯一权威；合并到 `main` 后由 GitHub Actions 自动对齐目录。

1. Fork 本仓库，从 `main` 开分支。
2. **只**在一个 `apps/{id}/` 下添加或修改完整包文件（建议先用 Myriad [`@myriad/tapp-cli`](https://github.com/Myriad-You/Myriad/tree/preview/tools/tapp-cli) 本地 `check` / `pack`）。可附带文档或脚本，但不可夹带第二个 app。
3. 确保 `manifest.id` === 文件夹名；bump `manifest.version`；`category` 使用稳定 ID。
4. 本地校验：

   ```bash
   node scripts/check-pr-scope.mjs         # 单 app + 未改 index.json
   node scripts/sync-index.mjs validate   # 包完整性 + 可从 manifest 推导 download
   node scripts/sync-index.mjs report     # 查看与当前 index 的差异（信息用，PR 不必修 index）
   node scripts/validate-previews.mjs     # 若已有 preview 声明
   ```

5. 提交 Pull Request（**不要**包含 `index.json` 改动；**不要**一次改多个 app）。
6. 合并后 **Catalog Sync** workflow 会运行 `scripts/sync-index.mjs sync`，按 manifest 重写 `index.json` 的对齐字段与 `download` 表。

### PR 流程（CI）

| 阶段 | 行为 |
| ---- | ---- |
| PR | 若 diff 含 `index.json` → **失败** |
| PR | 若 `apps/` 下变更涉及 **超过 1 个 app** → **失败** |
| PR | `sync-index.mjs validate`：manifest / 文件齐全、可生成 download |
| PR | `validate-previews.mjs`：现有 index 中的 preview 仍合法 |
| 合并到 `main` | bot 自动 `sync` 对齐 `index.json` 并提交 |

### 谁改什么

| 内容 | 谁维护 | 位置 |
| ---- | ------ | ---- |
| 应用代码与 `manifest.json` | 贡献者 | `apps/<id>/` |
| 目录对齐字段（version、category、permissions、download、size、icon…） | **bot / 脚本** | `index.json`（由 manifest 生成） |
| 商店展示字段（long_description、tags、featured、preview…） | 首次由 bot 生成；之后随已有条目保留 | `index.json`（勿在普通 PR 手改） |

维护者若需立即预览对齐结果（不经过 PR）：

```bash
node scripts/sync-index.mjs sync          # 重写 index.json
node scripts/sync-index.mjs check         # 断言已对齐
```

### 发布检查清单

- [ ] **只改了一个** `apps/<id>/`
- [ ] **未** 修改 `index.json`
- [ ] `manifest.main` 与包内入口文件名一致（`main.js` / `index.js`）
- [ ] Manifest 声明的 page/widget CSS、HTML 模板、`pageModules` 均在包内
- [ ] `manifest.assets` 均在 `{packageRoot}/assets/...`
- [ ] `category` 为规范 ID（不要用 `games` 等旧别名）
- [ ] 路径大小写与 Git 一致
- [ ] `node scripts/check-pr-scope.mjs` 与 `node scripts/sync-index.mjs validate` 通过

## 当前应用

以 `index.json` 的 `apps` 为准，包括但不限于：

| ID | 说明 |
| -- | ---- |
| `com.myriad.music-player` | 系统音乐控制 |
| `com.myriad.quick-notes` | 便签 + Widget |
| `com.myriad.config-generator` | 部署配置生成 |
| `com.myriad.doudizhu` | 斗地主（含 assets） |
| `com.myriad.aro` | 社交中心 |
| `com.myriad.cdn-cache` | CDN 缓存刷新（管理员） |

## 开发者文档

| 路径 | 说明 |
| ---- | ---- |
| [development/TAPP_DEVELOPMENT.md](./development/TAPP_DEVELOPMENT.md) | 文档索引与 Myriad 链接 |
| [development/tapp/STORE.md](./development/tapp/STORE.md) | 商店协议全文（与 Myriad 同步） |
| [development/tapp/](./development/tapp/) | Manifest / SDK / 沙箱等镜像 |

完整运行时与后端边界请读 Myriad 主仓库文档，不要仅依赖本镜像。

## 许可证

MIT License
