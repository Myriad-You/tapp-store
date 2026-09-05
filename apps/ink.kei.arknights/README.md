# Arknights Tapp

明日方舟玩家个人信息展示 Tapp，运行于 [Myriad Tapp](https://github.com/myriad-you) 平台。

通过森空岛（Skland）账号绑定，展示博士等级、助战干员、干员收藏、时装、蚀刻章、集成战略 / 剿灭 / 保全派驻等游戏数据。

## 功能

- **主页**：博士信息概览、助战干员、我的干员、游戏数据（活动剧情 / 集成战略 / 剿灭 / 保全派驻）
- **我的方舟**：干员 / 时装图鉴，支持职业、稀有度筛选与类型排序
- **小组件**：玩家信息卡（`4x2` / `4x4`，4x4 额外展示助战干员）
- **多语言**：简体中文 / English
- **主题适配**：亮色 / 暗色（基于 ak-ui 设计语言）
- **Debug 页**（管理员）：森空岛 API 接口测试

## 数据来源

基于森空岛公开接口（`zonai.skland.com`），需要用户提供 `cred,token` 完成账号绑定：

1. 在已登录的森空岛官网控制台执行脚本获取 `cred` 与 `token`
2. 将 `cred,token` 粘贴到应用输入框
3. 应用自动选择绑定账号并拉取玩家数据

干员头像、精英化标识等素材来自可自定义的素材仓库（默认指向 [leaphy-dev/ArknightsGameResource](https://github.com/leaphy-dev/ArknightsGameResource)），可通过设置项 `resourceBaseUrl` 指向自己的 fork。

## 项目结构

```
.
├── manifest.json          # Tapp 清单（入口、权限、小组件、API、设置）
├── core.js                # 共享层：i18n、玩家数据计算、资源 URL 工具
├── page.html              # 页面模板
├── styles.css             # 样式（ak-ui 设计语言 + 组件）
├── page/
│   ├── index.js           # 入口：路由 + 生命周期 + 资源预热
│   ├── home.js            # 主页渲染与账号绑定流程
│   ├── collection.js      # 干员 / 时装图鉴
│   ├── assets.js          # 卡片 / 助战 / 占位等 DOM 构建
│   ├── skland.js          # 森空岛接口签名与请求
│   ├── crypto.js          # 签名加密工具
│   └── debug.js           # Debug 页（管理员）
├── widget/
│   └── player-summary.js  # 玩家信息小组件（4x2 / 4x4）
├── i18n/
│   ├── zh-CN.json
│   └── en-US.json
├── assets/                # 包内资源（职业 / 精英化 / 潜能 / 星级图标等）
└── types/                 # Tapp SDK 类型声明
```

## 版权声明

Tapp 所涉及的公司名称、商标、产品等均为其各自所有者的资产，仅供识别。Tapp 内使用的游戏图片、动画、音频、文本原文，仅用于更好地表现游戏资料，其版权属于 Arknights / 上海鹰角网络科技有限公司。
