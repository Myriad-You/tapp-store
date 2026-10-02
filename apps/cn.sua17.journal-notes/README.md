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
- **点击展开**：在小组件内以浮层阅读笔记全文（带封面头图）
- **headless 后台同步**：安装后常驻同步，页面不开也保持最新
- **事件驱动刷新**：headless 写入 storage 后宿主自动刷新可见小组件
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
  ├─ Tapp.scheduler 按 syncInterval 周期同步
  └─ 监听 storage ping，小组件可见且数据过旧时触发即时同步

Widget (widget/index.js)
  ├─ 幂等 render：读 storage 缓存 → 按 size 组装 DOM（textContent 防注入）
  ├─ 缩略图渲染：同源/data: 才挂 <img>（懒加载 + 淡入），失败即移除，
  │   底层为 --jn-hue 渐变 + 首字占位
  ├─ storage.onChanged 局部重绘
  └─ 点击条目 → 全文浮层（z-30，带封面头图）
```

同步状态记录在 `journal.notes.status`，失败时小组件展示错误态与重试按钮。

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
| `storage:read`      | 小组件读取同步缓存与安装级设置                   |
| `storage:write`     | headless 写入笔记缓存；小组件写入同步 ping        |
| `scheduler:register`| 注册周期同步任务                                  |

## 安装级默认设置

| 设置项          | 类型   | 默认值 | 说明                             |
| --------------- | ------ | ------ | -------------------------------- |
| `maxNotes`      | number | 20     | 同步并保留的最大笔记数（5-60）  |
| `syncInterval`  | number | 15     | 后台同步间隔，分钟（5-720）     |
| `fetchContent`  | toggle | true   | 同步正文，用于浮层阅读全文      |

## 更新日志

### v1.0.0

- 首个版本：2×2 / 4×2 / 4×4 三尺寸小组件
- 缩略图：同源化规范化 + 渐变占位兜底，浮层封面头图
- 阅读状态：未读圆点/加粗、星标角标、阅读时长元信息
- headless 后台同步 + scheduler 周期刷新 + storage 事件驱动重绘
- 全文浮层阅读、错误/空/骨架微光状态、亮暗双主题、三语文案
