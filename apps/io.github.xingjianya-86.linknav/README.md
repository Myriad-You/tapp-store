# 链接小窝 · LinkNav

把网址收藏与分享做成萌系贴纸风的导航页：管理员维护共享链接目录并按角色分层可见，人人可收藏，桌面小组件快捷直达。

## 功能

- **分层可见**：每条链接的可见范围是「所有人（含游客）」「登录用户」「仅管理员」之一，前端按 `Tapp.user.getRole()` 自动过滤；管理员专属链接存放在安装级私有数据（`Tapp.private`），不会进入访客可读的共享数据。
- **共享目录**：公开/登录可见的链接存放在 `Tapp.shared`，站长或管理员在小窝里直接增删改，所有能打开该安装的人（含游客）都能浏览。
- **个人收藏**：登录用户点卡片上的小星星即可收藏，存放在自己的 `Tapp.storage` 私有空间，互不可见。
- **搜索与筛选**：支持按标题、域名、备注、标签搜索，按标签筛选，置顶链接优先展示。
- **快捷组件**：Dashboard 小组件（2x2 / 4x2）展示置顶链接，点击直达。
- **三语与主题**：简体中文 / English / 日本語，浅色与深色主题自适应，动效跟随系统「减少动态效果」。

## 外链打开的限制

Myriad 沙箱禁止 `window.open` 与顶层导航，外链只能通过 `Tapp.ui.openUrl` 打开 **Manifest `openUrls` 白名单**里声明的站点（本版本约 28 个常见站点，`match: "origin"`，可覆盖该域名下的任意路径）。

- 命中白名单：直接打开，也可以在表单里看到「可以直接打开～」提示。
- 未命中白名单：卡片提供「搜索」与「复制」；点击卡片会用已声明的搜索引擎（Bing → Baidu → Google）搜索该网址，搜索打开失败时自动复制链接兜底，不会静默失败。
- 想**直达**新站点的管理员需要提交一个版本更新，把域名加进 `manifest.json` 的 `openUrls`（上限 32 条）；只求“能点开”的话，搜索兜底无需改 Manifest。

## 管理员用法

1. 以管理员身份打开链接小窝，右上角会出现「投喂新链接」。
2. 填写网址、标题、备注、emoji 图标、标签，选择可见范围，可勾选置顶。
3. 网址输入框下方会实时提示该链接能否直接打开。
4. 卡片上的「编辑 / 删除」只对管理员显示；删除前会弹出确认。

数据写入 `Tapp.shared`（公开/登录可见）与 `Tapp.private`（仅管理员）两个键：

| key | 命名空间 | 说明 |
| --- | --- | --- |
| `linknav.links.v1` | `Tapp.shared` | 可见范围为 guest / user 的链接 |
| `linknav.links.v1` | `Tapp.private` | 可见范围为 admin 的链接 |
| `linknav.favorites.v1` | `Tapp.storage` | 当前用户收藏的链接 id 列表 |

## 图标本地缓存

每条链接的图标优先使用**本地缓存的图片**（`data:` URI），不需要任何网络权限，访客与离线场景都能正常显示；没有缓存图片时依次回退到域名 emoji 表、标题首字母色块。

- 管理员在投喂/编辑弹窗里点「上传图片」，选择 PNG / JPEG / WebP（≤256 KB），前端会压成 64×64 PNG（保留透明、超 64 KB 自动降到 48×48）再保存。
- 图片单独存键：`linknav.icon.v1.<linkId>`，公开/登录可见链接存 `Tapp.shared`，仅管理员链接存 `Tapp.private`；单图标 ≤64 KB，图标总量软上限 4 MB（与安装 owner 的 8 MiB 配额共用）。
- 删除链接会同步清理对应图标键；保存时会自动清理孤儿图标。
- 仅接受位图（拒绝 SVG），渲染用 `<img>`，不做任何远程图片请求。

## 自动获取图标（浏览器本机）

管理员在弹窗里点「获取 favicon」，或让 URL 输入框失焦时，应用会在**管理员本机浏览器**里直连 `https://icon.horse/icon/<域名>`（该服务返回 `Access-Control-Allow-Origin: *`），用 canvas 读出像素、压成 64×64 PNG，再存入本地图标键；缓存完成后所有访客都直接读本地数据，渲染时不再联网。

- 需要 Manifest 声明 `network:fetch`（elevated，安装时批准）。未获授权时「获取 favicon」按钮自动隐藏，手动上传仍然可用。
- 只把域名发给 `icon.horse`，图标字节不经过任何第三方代理，最终保存在你的实例里（`Tapp.shared` / `Tapp.private`）。
- 服务不可达、域名没有 favicon 或 canvas 读像素失败时会提示「获取失败」，可以改用手动上传。
- 想换成自建服务：修改 `page/index.js` 顶部的 `FAVICON_SERVICE` 常量即可，要求该服务支持 CORS（返回 `Access-Control-Allow-Origin: *`）并直接返回图片。

## 权限

| 权限 | 用途 |
| --- | --- |
| `storage:read` / `storage:write` | 读取 / 写入共享链接、私有链接与个人收藏 |
| `network:fetch` | 管理员自动获取 favicon（本机浏览器直连 icon.horse，压缩后存入本地图标数据；未授权则回退手动上传） |
| `ui:openUrl` | 打开 `openUrls` 白名单内的链接（配合 `openUrls` 声明） |
| `ui:notification` / `ui:confirm` | 操作提示与删除确认 |
| `ui:theme` | 跟随主题与壁纸主色 |
| `widget:register` | 声明式 Widget 注册（安装时预注册，普通用户不会获得该权限的运行时授予） |

应用声明 `network:fetch`，仅用于管理员自动获取 favicon：在管理员本机浏览器里直连 `icon.horse` 抓图，压缩后存入本地图标数据，之后所有访客都读本地缓存。不抓取网页标题或其它元数据，不使用远程脚本。`page.html` 另外通过 `<link>` 加载 Google Fonts 圆体（宿主 CSP 对字体主机默认放行，不需要 `network:fetch`；加载失败回退系统圆体）。商店静态预览（`preview.html` / `preview.css`）不含远程资源。未获 `network:fetch` 授权时自动获取按钮自动隐藏，手动上传始终可用。

## 文件结构

```
manifest.json       # 清单：页面、Widget、权限、openUrls 白名单
catalog.json        # 商店展示：长介绍、标签、静态预览
core.js             # 共享层：角色、数据读写、角色过滤、openUrl 匹配、收藏
page/index.js       # 页面层：搜索 / 筛选 / 收藏 / 管理 CRUD
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

## 开发提示

- 本地校验：`node tapp-cli/bin/myriad-tapp.mjs check apps/io.github.xingjianya-86.linknav --json`
- 打包：`node tapp-cli/bin/myriad-tapp.mjs pack apps/io.github.xingjianya-86.linknav --json`
- 新增白名单站点后必须提高 `manifest.version`；白名单上限 32 条。
- 链接数据单值上限 1 MiB，应用内限制 500 条。

## 许可

MIT
