# Arknights Tapp

明日方舟玩家个人信息展示 Tapp，运行于 [Myriad Tapp](https://github.com/myriad-you) 平台。

通过森空岛（Skland）账号绑定，展示博士等级、助战干员、干员收藏、时装、蚀刻章、集成战略 / 剿灭 / 保全派驻等游戏数据。

## 功能

- **主页**：博士信息概览、助战干员、我的干员、游戏数据（活动剧情 / 集成战略 / 剿灭 / 保全派驻）
- **我的方舟**：干员 / 时装图鉴，支持职业、稀有度筛选与类型排序
- **小组件**：玩家信息卡（`4x2` / `4x4`，4x4 额外展示助战干员）；每个实例可独立配置展示的玩家 `uid`（`widgets[].settings`，经 `props.config` 读取），未配置时按默认 / 上次浏览选择，越权或不存在时给出提示
- **多语言**：简体中文 / English
- **主题适配**：亮色 / 暗色（基于 ak-ui 设计语言）
- **Debug 页**（管理员）：森空岛 API 接口测试

## 数据来源

基于森空岛公开接口（`zonai.skland.com`），通过**鹰角账号密码**登录完成绑定：

1. 在应用内输入鹰角账号的手机号与密码
2. 应用登录换取鹰角账号 `token`，存入用户私有 `Tapp.storage`（键 `hgToken`）
3. 应用用账号 Token 换取森空岛 `cred` 与**签名 Token**，选择绑定账号并拉取玩家数据

干员头像、精英化标识等素材来自可自定义的素材仓库（默认指向 [leaphy-dev/ArknightsGameResource](https://github.com/leaphy-dev/ArknightsGameResource)），可通过设置项 `resourceBaseUrl` 指向自己的 fork。

## 权限与共享展示

玩家账户存于**玩家列表**（键为玩家 `uid`）：

- 私有列表（`Tapp.storage`，键 `arkPlayerMap`）：完整记录，含 `hgToken`、`isPublic`，仅管理员读写。
- 公开列表（`Tapp.shared`，键 `arkPublicPlayerMap`）：仅 `isPublic` 的记录，剔除 `hgToken` / `isPublic`，供所有用户只读展示。

鹰角账号 `hgToken` 存于用户私有 `Tapp.storage`（键 `hgToken`）；森空岛 `cred` 与签名 token 由账号 Token 在会话内自动换取，不落盘。`arkLastViewedPlayer` 记录当前用户上次浏览的玩家 `uid`。

- **管理员**（`Tapp.user.isAdmin()` 为真）：读私有列表；右上角「刷新」刷新当前浏览玩家（仅 token 失效才跳转添加玩家页），旁边「玩家列表」管理账户（公开开关 / 默认展示，底部加号进入添加玩家页）；页脚有 Debug 入口。
- **其他用户**：读公开列表，只读。公开列表为空时，展示区居中显示 `No Player Data`。

## 项目结构

```
.
├── manifest.json              # Tapp 清单（入口、权限、小组件、API、设置）
├── catalog.json               # 商店元数据（简介、标签、预览配置）
├── core.js                    # 共享层：i18n、玩家数据缓存与读取、资源 URL 工具
├── core.css                   # 共享样式（ak-ui 设计语言基础）
├── page/
│   ├── index.js               # 入口：路由 + 生命周期 + 资源预热
│   ├── template.html          # 页面模板
│   ├── styles.css             # 页面样式
│   ├── api-skland.js          # 森空岛接口签名与请求（core 加载的共享模块）
│   ├── api-crypto.js          # 签名加密工具（SHA-256 / HMAC / MD5）
│   ├── ui-assets.js           # 卡片 / 助战 / 占位等 DOM 构建
│   ├── ui-dialog.js           # ak-dialog 确认对话框（原生 <dialog>）
│   ├── view-home.js           # 主页渲染
│   ├── view-player-list.js    # 玩家列表（公开开关 / 默认展示）
│   ├── view-add-player.js     # 添加玩家（登录 + 选择账号；凭证安全告警 + 页脚版权）
│   ├── view-collection.js     # 干员 / 时装图鉴
│   └── view-debug.js          # Debug 页（管理员）
├── widget/
│   ├── player-summary.js      # 玩家信息小组件（4x2 / 4x4）
│   └── styles.css             # 小组件样式（亮 / 暗主题变量）
├── i18n/
│   ├── zh-CN.json
│   └── en-US.json
├── assets/                    # 包内资源（职业 / 精英化 / 潜能 / 星级图标、页面装饰与概要图标等）
├── scripts/
│   └── generate-preview.mjs   # 生成商店预览快照
├── tests/
│   └── core.test.js           # core.js 单元测试（node --test）
└── types/                     # Tapp SDK 类型声明
```

> `core.js` 是 Page / Widget / Headless 三模式共用的共享层。玩家数据按 `uid` 存于玩家列表
> （管理员读 `Tapp.storage`、非管理员读 `Tapp.shared`，见 `getPlayerMap`），由 `loadPlayerData(uid)`
> 加载并按 `uid` 缓存，渲染期通过各 `getPlayerX(uid)` 同步读取。已弃用旧的全局单槽键
> `arknights.player`。
>
> 森空岛接口与加密工具（`page/api-skland.js`、`page/api-crypto.js`）以 CommonJS 模块提供，
> 由 `core.js` require 并以 `core.skland` 暴露（平台仅收录 `page/` 下的额外 JS），
> Page 通过 `core.skland` 调用；后续 Headless 也可直接复用。
>
> `page/` 内无法建子目录，故用文件名前缀分类：`api-`（接口/加密）、`ui-`（DOM 构建）、
> `view-`（视图渲染）。

## 版权声明

Tapp 所涉及的公司名称、商标、产品等均为其各自所有者的资产，仅供识别。Tapp 内使用的游戏图片、动画、音频、文本原文，仅用于更好地表现游戏资料，其版权属于 Arknights / 上海鹰角网络科技有限公司。
