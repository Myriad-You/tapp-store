# 链接小窝 · LinkNav

Myriad 上的萌系网址导航 Tapp：管理员维护共享链接目录并按角色分层可见，人人可收藏，图标本地缓存，桌面小组件快捷直达。

> 本仓库是 LinkNav 的源码仓库；商店收录包位于 [Myriad-You/tapp-store · apps/io.github.xingjianya-86.linknav](https://github.com/Myriad-You/tapp-store/tree/main/apps/io.github.xingjianya-86.linknav)。

## 功能

- **分层可见**：每条链接的可见范围是「所有人（含游客）」「登录用户」「仅管理员」之一，前端按 `Tapp.user.getRole()` 过滤；管理员专属链接存在安装级私有数据（`Tapp.private`），不会进入访客可读数据。
- **共享目录**：公开/登录可见的链接存在 `Tapp.shared`，站长/管理员在小窝里直接增删改，所有能打开该安装的人都能浏览。
- **个人收藏**：登录用户点卡片上的小星星即可收藏，存在自己的 `Tapp.storage` 私有空间，互不可见。
- **图标本地缓存**：上传图片（PNG/JPEG/WebP ≤256 KB，压缩为 64×64 PNG），或在浏览器里直连 `icon.horse` 自动抓取 favicon；缓存后所有访客直接读本地 `data:`，离线可用。图标单独存键 `linknav.icon.v1.<linkId>`，删除链接自动清理。
- **搜索与筛选**：按标题、域名、备注、标签搜索；标签筛选；置顶优先。
- **快捷组件**：Dashboard Widget「链接小窝」（2x2 / 4x2）展示置顶链接，点击直达。
- **批量导入 / 导出**：导出完整 JSON（可含图标）/ URL 文本 / CSV / 收藏；导入支持 JSON、URL 文本、浏览器书签 HTML、CSV，带预览列表与重复策略。
- **三语与主题**：简体中文 / English / 日本語；浅色与深色主题；动效跟随系统「减少动态效果」。

## 外链打开方式（分级）

Myriad 沙箱禁止 `window.open` 与顶层导航，外链只能通过 `Tapp.ui.openUrl` 打开 Manifest `openUrls` 白名单内的站点：

- **命中白名单**：一键直达（本版本约 28 个常见站点，`match: "origin"`，覆盖该域名下任意路径）。
- **本站链接**：manifest 额外声明 `{ "id": "self", "url": "/", "match": "same-origin" }`，由宿主相对自身 origin 解析，任何自托管域名都直达本站页面（需宿主支持 `same-origin`）。
- **未命中白名单**：提供「搜索打开」——用已声明的搜索引擎（Bing → Baidu → Google）搜索该网址，另有一键复制；都不会静默失败。
- 想让新站点**直达**：把域名加进 `manifest.json` 的 `openUrls`（上限 32 条）并发布新版本；只求“能点开”则无需改动。

## 批量导入 / 导出（管理员）

页头「导入 / 导出」提供：

- **导出**：完整 JSON（`{ app, schema: 1, exportedAt, links: [...] }`，勾选后附 `icons` base64）/ 纯 URL 文本 / CSV（带 BOM）/ 我的收藏（URL）；下载走 `Tapp.file.download`，失败自动进复制面板
- **导入**：拖拽 / 选文件 / 粘贴，自动识别 **JSON / URL 文本（`标题 URL`、行尾 `#标签`）/ 浏览器书签 HTML / CSV**；可强制格式，解析失败自动回退「自动识别」
- **导入列表预览**：逐条勾选、可见性下拉、状态徽标（新增 / 重复 / 无效）、筛选与全选；重复策略「跳过（默认）/ 覆盖同 URL」；可自动抓取缺失 favicon
- 上限：链接 500 条；图标单图 ≤64 KB、总量软上限 4 MB

## 安装

- Myriad 商店安装（收录合并后可见）：`io.github.xingjianya-86.linknav`。
- 本地安装：用 Myriad tapp-cli 打包后上传 `.tapp`：

```bash
npx --yes --package=@myriad-you/tapp-cli@0.1.4 myriad-tapp check . --json
npx --yes --package=@myriad-you/tapp-cli@0.1.4 myriad-tapp pack . --json
# 产物：dist/io.github.xingjianya-86.linknav.tapp
```

## 权限

| 权限 | 用途 |
| --- | --- |
| `storage:read` / `storage:write` | 读写共享链接、私有链接与个人收藏 |
| `network:fetch` | 仅管理员自动获取 favicon（浏览器本机直连 icon.horse）；未授权时按钮隐藏、手动上传可用 |
| `ui:openUrl` | 打开 `openUrls` 白名单内的链接 |
| `ui:notification` / `ui:confirm` | 操作提示与删除确认 |
| `ui:theme` | 跟随主题与壁纸主色 |
| `widget:register` | 声明式 Widget 注册（安装时预注册） |

不抓取网页标题或其它元数据，不使用远程脚本；商店静态预览（`preview.html` / `preview.css`）无远程资源。`page.html` 通过 `<link>` 引入 Google Fonts 圆体（宿主 CSP 默认放行字体主机，加载失败回退系统圆体）。

## 目录结构

```
manifest.json       # 清单：页面、Widget、权限、openUrls 白名单
catalog.json        # 商店展示：长介绍、标签、静态预览
core.js             # 共享层：角色、数据读写、角色过滤、openUrl 匹配、图标存储、搜索兜底
page/index.js       # 页面层：搜索 / 筛选 / 收藏 / 管理 CRUD / 图标处理
page.html           # 页面模板（含圆体字体与吉祥物 SVG）
page.css            # 萌系贴纸 / 果冻样式
widget/index.js     # Widget 渲染
widget-2x2.html     # 2x2 模板
widget-4x2.html     # 4x2 模板
widget.css          # Widget 样式
i18n/*.json         # zh-CN / en-US / ja-JP 文案
preview.html        # 商店静态预览（无脚本）
preview.css         # 预览样式
```

## 数据键

| key | 命名空间 | 说明 |
| --- | --- | --- |
| `linknav.links.v1` | `Tapp.shared` | 可见范围为 guest / user 的链接 |
| `linknav.links.v1` | `Tapp.private` | 可见范围为 admin 的链接 |
| `linknav.favorites.v1` | `Tapp.storage` | 当前用户收藏的链接 id 列表 |
| `linknav.icon.v1.<linkId>` | `Tapp.shared` / `Tapp.private` | 本地缓存图标（`data:image/...`，单图 ≤64 KB，总量软上限 4 MB） |

## 开发

需要 Node.js 20+。校验与打包：

```bash
npx --yes --package=@myriad-you/tapp-cli@0.1.4 myriad-tapp check . --json
npx --yes --package=@myriad-you/tapp-cli@0.1.4 myriad-tapp pack . --json
```

参考文档：[Myriad Tapp 开发索引](https://github.com/Myriad-You/Myriad/blob/preview/docs/development/TAPP_DEVELOPMENT.md) · [Tapp 商店协议](https://github.com/Myriad-You/tapp-store/blob/main/development/tapp/STORE.md)

## 许可

[MIT](LICENSE)
