# 银河球棒侠 · Galactic Batter

Myriad 上的崩坏：星穹铁道数据面板 Tapp：站长通过米游社扫码（或手动粘贴 Cookie）绑定账号后，页面与桌面小组件展示开拓力、委托、角色简表、混沌回忆 / 虚构叙事 / 末日幻影战绩。

## 功能

- **扫码绑定**：HYP 扫码（`createQRLogin` / `queryQRLoginStatus`，按 `tokens[].name` 解析 stoken/ltoken/cookie_token），二维码在沙箱内用纯 JS 生成，不经过任何第三方服务
- **Cookie 绑定**：站长 / 管理员也可以在「站长设置」粘贴米游社 Cookie（需含 `ltuid/ltoken` 或 `stoken`），应用会自动补全 `ltoken` / `cookie_token`
- **机器码 / 设备指纹**：站长设置里粘贴设备信息 JSON（多行框，字段缺失自动补默认），应用解析后通过 `device-fp` 接口生成设备指纹并随战绩请求发送，降低风控概率；下方实时显示解析结果，调试面板可查看指纹
- **素材本地化**：刷新成功后把头像 / 角色图 / 终局队伍头像经 canvas 压成 64px 缓存到共享数据（按 URL 增量、单图 ≤200KB、总量 ≤4MB、失败 7 天后重试）；渲染优先用本地缓存，离线可用，缺失回退远程热链
- **站长共享**：游戏 UID / 服务器 / 机器码 / Cookie 都在页面「站长设置」里配置，保存在安装级私有数据（`Tapp.private`），仅站长 / 管理员可读；游客与普通成员读取共享缓存
- **页面**：米游社 + 游戏双头像、开拓力 / 后备开拓力 / 每日实训 / 委托 / 历战余响 / 差分宇宙 / 探索成就、角色简表（前 16，点击跳转开拓者笔记角色页）、终局区块（混沌回忆本期 / 上期、虚构叙事、末日幻影：星星数、最深楼层，以及**最后一关（星启模式，最高难度）**的轮次与上下半队伍、得分与通关时间）
- **小组件**（每尺寸独立模板，信息量随尺寸递增；事件驱动刷新）：
  - `starrail` 2x2（头像 + 开拓力/实训/委托三行）/ 4x2（横排状态 + 前 8 角色，60px 横滑）/ 4x4（回满时间 + 后备开拓力 + 探索成就 + 前 12 角色带名称）
  - `endgame` 2x2（混沌/虚构/末日三行星星数）/ 4x2（Tab 切换 + 星星数与最后一关通关时间）/ 4x4（Tab + 最后一关上下半队伍与得分）
  - 角色头像点击直达米游社开拓者笔记角色页（`sr_wiki` 搜索解析 + `ui:openUrl`）
- **三语与主题**：简体中文 / English / 日本語，浅色与深色自适应
- **调试面板**（站长可见）：显示角色 / 设置 / 凭据（脱敏）/ 设备指纹 / 缓存与错误码 / 最近扫码响应（`qr`）/ 定时任务状态，一键逐个调用 API、手动触发后台同步
- **定时刷新**：`Tapp.scheduler` 注册 `starrail-sync`（cron `0 */6 * * *`，每 6 小时一次），由 headless core 在站长会话在线时执行；另有页面/小组件「缓存超过 6 小时自动刷新」兜底。两者都受风控冷却保护
- **共享层**：`styles.css`（`core.styles`，Page / Widget 共用令牌与原子类）+ `core.js` 内共享 UI（DOM 工具、数据选择器、角色卡与空态渲染）；小组件按 `props.size` 使用独立模板

## 使用

1. 打开页面进入「站长设置」，填写**游戏 UID**、**服务器**（官服 / B服 / 国际服）、**机器码 / 设备信息**（已带默认 JSON），点「保存设置」
2. 在同一区域点「扫码绑定」用米游社 App 扫码确认；也可以手动粘贴 Cookie
3. 点「刷新」拉取数据（同时增量缓存素材）；小组件读取共享缓存，数据更新时自动刷新

## 数据接口（Manifest `apis`，除 `obcSearch` 外均 `access: "manager"`）

| API | 用途 |
| --- | --- |
| `dailyNote` | 开拓力 / 委托 / 每日实训 / 后备开拓力 / 历战余响 / 差分宇宙 |
| `playerIndex` | 玩家资料、探索与成就、角色简表 |
| `bbsUser` | 米游社账号资料（头像） |
| `challenge` | 混沌回忆（`schedule_type=1` 本期 / `2` 上期） |
| `challengeStory` | 虚构叙事 |
| `challengeBoss` | 末日幻影 |
| `hypQrCreate` / `hypQrCheck` | HYP 扫码登录 |
| `stokenToCookie` / `getLTokenBySToken` | 用 stoken 补全 `cookie_token` / `ltoken` |
| `deviceFp` | 生成设备指纹（`public-data-api` `device-fp/api/getFp`） |
| `obcSearch` | 开拓者笔记角色词条搜索（`api-static` `sr_wiki`，`access: "public"`） |

DS 签名（`salt&t&r&b&q`）在 `core.js` 内用纯 JS 计算，盐值与 `x-rpc-app_version` 对齐 `gsuid_core`（当前 2.102.1）。米游社更新盐值后需要发版同步。

## 权限

| 权限 | 用途 |
| --- | --- |
| `network:fetch` | 调用声明式 API（米游社） |
| `storage:read` / `storage:write` | 共享缓存与私有 Cookie |
| `ui:notification` / `ui:confirm` / `ui:theme` | 提示、确认与主题 |
| `ui:openUrl` | 打开开拓者笔记角色页 |
| `widget:register` | 声明式 Widget 注册 |
| `scheduler:register` | 注册 6 小时定时刷新任务 |

## 风险与说明

- 米游社接口存在风控与频率限制；应用只在站长 / 管理员触发刷新，并缓存结果（数据 5 分钟、终局 30 分钟）。请求之间自动留间隔、扫码轮询 3 秒起；一旦命中风控码（10035/5003/10041/1034/10104）会立即停止后续请求并进入冷却（15 分钟起，重复命中翻倍、上限 60 分钟），冷却期内刷新与调试测试直接跳过并返回剩余时间
- Cookie 会以明文进入沙箱（`Tapp.private`），仅站长 / 管理员可读；建议使用专门的小号
- 游戏战绩接口（开拓力 / 角色 / 终局）要求 Cookie 含 `ltoken` 或 `ltoken_v2`；扫码登录会按 `ltoken = HYP token`（TRSS 验证方案）组装，并用 `getCookieAccountInfoBySToken`（带 `mid`）补 `cookie_token`。手动 Cookie 若含 `stoken`，刷新与调试会自动补全（先试 `getLTokenBySToken`，失败则 `ltoken = stoken`）。仅含 `cookie_token` 且无 stoken 的 Cookie 只能读取米游社资料（`bbsUser`），战绩接口会返回 `10001 Please login`
- 机器码解析结果仅用于请求头 `x-rpc-device_id` / `x-rpc-device_fp`，生成的指纹保存在安装级私有数据；默认值可自行替换为其他真实设备
- 素材缓存依赖米游社 CDN 的 CORS（canvas 读像素）；若某图片无法缓存会标记失败并回退热链，调试面板「测试图片缓存」可查看结果
- 头像 / 角色图使用远程热链，需要运行环境授予 `network:fetch`；未授权时回退首字母占位
- 数据来自米游社公开接口，仅供参考

## 开发

```bash
node tapp-cli/bin/myriad-tapp.mjs check . --json
node tapp-cli/bin/myriad-tapp.mjs pack . --json
```

参考实现：`Genshin-bots/gsuid_core`、`Scighost/Starward`（hkrpg 接口参数）。

## 许可

MIT（`page/qrcode.js` 来自 kazuhikoarase/qrcode-generator，MIT）
