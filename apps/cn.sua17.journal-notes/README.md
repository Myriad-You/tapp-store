# 手账笔记

在主页小组件里速览 Myriad 手账（Phantasi）最新笔记。

- 源码仓库：https://github.com/xingjianya-86/journal-notes-tapp
- 商店条目：`cn.sua17.journal-notes`（[tapp-store](https://github.com/Myriad-You/tapp-store)）

## 安装

从 [Releases](https://github.com/xingjianya-86/journal-notes-tapp/releases) 下载 `.tapp`
在 Myriad 的 Tapp 商店页选择「安装本地 Tapp」（需 Myriad ≥ 0.5.0）。

## 功能

- **三种尺寸**：2×2 双条速览 · 4×2 封面分区 · 4×4 缩略图笔记墙
- **缩略图**：封面/正文首图同源化后展示；CSP 不放行的外链自动降级为按笔记生成的渐变占位，永不破图
- **阅读状态**：未读高亮圆点与加粗、星标 ★ 角标、浮层内显示阅读时长
- **点击外开**：点击笔记直接在浏览器新标签打开本站原文。manifest 用 `openUrls: [{ id: "self", url: "/", match: "same-origin" }]` 声明，由宿主相对**自身 origin** 解析，因此在任何自托管域名下都能打开你自己的文章，不写死作者域名；宿主不支持或未命中时回退小组件内浮层
- **仅管理员同步**：admin 账号才触发同步刷新；同步结果同时发布到安装级共享区（`Tapp.shared`），**游客/普通账号直接读到 admin 的数据**（只读缓存角标），未发布时游客显示「需要登录」
- **headless 后台同步**：安装后常驻同步，页面不开也保持最新
- **事件驱动刷新**：headless 写入 storage 后宿主自动刷新可见小组件；无数据变化不写入、不重挂载，不再频繁闪骨架
- **可配置**：最大笔记数、同步间隔、是否同步正文
- **主题适配**：跟随宿主明暗主题、字体缩放与主题色
- **多语言**：简体中文、英文、日文

## 架构

Widget 沙箱没有 phantasi 数据接口，采用官方推荐的
「headless core → storage → Widget」链路：

```
headless core (core.js)
  ├─ Tapp.phantasiList.list 翻页拉取（过滤站内 link = 笔记）
  ├─ get(id) 补齐正文（可关闭），截断后写入
  ├─ 缩略图规范化：平台媒体路径转同源相对地址、防盗链 CDN
  │   走 /api/proxy/image、其余外链原样保留交渲染层降级
  ├─ Tapp.storage.set('journal.notes.payload', …)
  ├─ Tapp.shared.set 同步发布（内容有变化才写；游客可读，仅 owner/admin 可写）
  ├─ Tapp.scheduler 按 syncInterval 周期同步
  ├─ 监听 storage ping，管理员可见且数据过旧时触发即时同步
  └─ 角色门槛：仅 admin 同步；diag 标记（loaded/ready/sync-start）供超时定位

Widget (widget/index.js)
  ├─ 幂等 render：读 storage 缓存 → 按 size 组装 DOM（textContent 防注入）
  ├─ 角色分流：admin 读私有 storage（同步/ping/挂狗齐全）；
  │   游客/普通账号读 Tapp.shared（admin 发布的同一份数据）+「只读缓存」角标
  ├─ 缩略图渲染：同源/data: 才挂 <img>（懒加载 + 淡入），失败即移除，
  │   底层为 --jn-hue 渐变 + 首字占位
  ├─ storage.onChanged 局部重绘；ping 新鲜度 = max(数据, 同步, ping)
  └─ 点击条目 → ui.openUrl 新标签打开本站原文（same-origin 声明），未命中回退全文浮层
```

同步状态记录在 `journal.notes.status`，失败时小组件展示错误态与原始错误详情；
headless 无诊断产出时超时详情显示 `core: <阶段>` / `storage unavailable`。

## 目录

```
cn.sua17.journal-notes/
├── manifest.json          # 权限 / 后台需求 / 三尺寸 widgets / 安装级设置
├── core.js                # headless 同步核心
├── widget/index.js        # Widget 渲染层
├── widget/widget.css      # Widget 样式（亮暗双主题）
├── templates/             # 2x2 / 4x2 / 4x4 模板（根节点骨架）
├── styles.css             # core 共享基础样式
├── catalog.json           # 商店元数据（securityReview: true）
├── preview.html / css     # 商店预览
└── README.md
```

## 权限说明

| 权限                | 用途                                              |
| ------------------- | ------------------------------------------------- |
| `widget:register`   | manifest 声明主页小组件（安装校验必填）          |
| `phantasi:read`     | 读取手账（Phantasi）笔记列表与正文（需 Myriad ≥ 0.5.0，旧名 `brew:read` 已退役） |
| `storage:read`      | 小组件读取同步缓存与安装级设置；共享区读取（游客开放） |
| `storage:write`     | headless 写入笔记缓存与共享区发布；小组件写入同步 ping |
| `scheduler:register`| 注册周期同步任务                                  |
| `ui:openUrl`        | 点击笔记时在浏览器新标签打开本站原文（openUrls: `{ id: "self", url: "/", match: "same-origin" }`，相对宿主自身 origin 解析，需宿主支持 `same-origin` 匹配；旧宿主自动回退浮层） |

## 安装级默认设置

| 设置项          | 类型   | 默认值 | 说明                             |
| --------------- | ------ | ------ | -------------------------------- |
| `maxNotes`      | number | 20     | 同步并保留的最大笔记数（5-60）  |
| `syncInterval`  | number | 15     | 后台同步间隔，分钟（5-720）     |
| `fetchContent`  | toggle | true   | 同步正文，用于浮层阅读全文      |

## 更新日志

### v1.2.0

- **公开可用外开**：`openUrls` 改用 `{ id: "self", url: "/", match: "same-origin" }`，由宿主相对自身 origin 解析原文链接，任何自托管域名都能新标签打开自己的手账文章，不再写死 `sua17.cn`
- **修复外开失效**：移除依赖 `document.referrer` / `window.location.origin` 的 `siteOrigin()`（Widget 为 `srcdoc` 不透明源且 `referrerpolicy="no-referrer"`，二者恒为空，导致点击永远回退浮层）；改为直接按声明解析
- 无 `same-origin` 宿主或未命中声明时仍回退小组件内浮层

### v1.1.1

- **游客可见 admin 数据**：headless 把笔记 payload 发布到安装级共享区（`Tapp.shared`，写仅 owner/admin、读对所有访客开放），游客/普通账号直接只读渲染同一份数据 +「只读缓存」角标；admin 发布时广播实时刷新访客卡片
- 注意：共享区内容**全站访客均可读**，请确认手账内容适合公开

### v1.1.0

- **仅管理员同步**：admin 账号才 ping/同步；游客未登录显示 🔒 需要登录（不再转圈后报超时），普通账号只读提示，有缓存时只读渲染并带「只读缓存」角标
- **修复刷新风暴**：ping 新鲜度改为 max(数据更新, 最近同步, 最近 ping)（最多 30 分钟一次）；无数据变化不再写 status → 宿主不再重挂载闪骨架
- **点击外开**：命中 `openUrls` 白名单（`sua17.cn`）时新标签打开原文，未命中回退浮层
- **超时诊断**：挂狗仅在完全无产出时触发、真实状态不再被 timeout 覆盖；超时详情显示 `core: loaded/ready/sync-start` 与 storage 可用性，core 同步中额外宽限 40 秒

### v1.0.2

- 错误态界面直接显示原始错误详情，便于定位「加载失败」的真实原因
- 错误信息拍平更完整（HTTP 状态码 / 响应体 / token / guest 等），登录类失败识别更准

### v1.0.1

- 游客模式（未登录）识别为专属「需要登录」状态：🔒 提示 + 重试按钮，登录后点击立即同步，不再误报「加载失败」

### v1.0.0

- 首个版本：2×2 / 4×2 / 4×4 三尺寸小组件
- 缩略图：同源化规范化 + 渐变占位兜底，浮层封面头图
- 阅读状态：未读圆点/加粗、星标角标、阅读时长元信息
- headless 后台同步 + scheduler 周期刷新 + storage 事件驱动重绘
- 全文浮层阅读、错误/空/骨架微光状态、亮暗双主题、三语文案
