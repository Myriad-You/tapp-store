# Aro

社交中心：消息（Channel/Room）、时间线、环网与个人资料。

> 官方社交 Tapp（version 1.1.0，需 Myriad ≥ v0.3.36）。设置页含出站投递队列与联邦签名密钥轮换（需宿主 `federation.rotateKeys`）。

## 功能

- 联邦消息 / 房间 / 关注 / 时间线 / 环网
- 聊天输入区 **表情/贴纸**：群共享贴纸包（宿主 `addRoomSticker` / `removeRoomSticker`，Myriad ≥ v0.3.14）+ 本机「我的」贴纸
- 出站投递列表：刷新 / 单项取消·重试 / 全部取消·重试失败
- 联邦签名密钥显式轮换（确认后 `rotateKeys(true)`）
- 后台轮询新消息通知（`backgroundRequirements: notification`）
- 中英日 i18n

## 权限

`storage:read`, `storage:write`, `ui:notification`,
`federation:read|interact|post|channel|room|ring|message|files`,
`platform:read`, `report:read`, `tappList:read|manage`, `brew:read`,
`media:control`, `network:fetch`

> 联邦写权限按动作域拆分：发帖与投递队列走 `federation:post`，关注/点赞/收藏/转发走
> `federation:interact`，私聊通道走 `federation:channel`，群组与群贴纸走 `federation:room`，
> 环网走 `federation:ring`。其中 `post` / `channel` / `room` 为 **elevated**，普通用户需站长下放。
>
> `network:fetch`：宿主沙箱将远端 `https` 图/媒体挂在此权限上（头像、封面、联邦附件直链）。
> 为 **elevated**；已安装实例更新时需重新授权该权限（否则只保留旧 granted 交集）。

## Changelog

### 1.1.0

- 迁移到层式包结构：`core`（headless 通知轮询）与 `page` 由 manifest 的层声明，
  页面文件之间用相对 `require` 互相引用，不再有 `pageModules` 清单。后台实例的注入
  范围只剩 core 闭包，拿不到任何页面源码。
- 页面各文件现在各有自己的模块作用域，跨文件的名字经 `page/scope.js` 重新挂到沙箱
  全局；会被改写的绑定（locale 表、缓存的浮层节点、飞行中的计数器）用访问器发布，
  免得读到的是加载那一刻的快照。
- 权限改用拆分后的名字：`storage` → `storage:read` + `storage:write`，
  `federation:write` → `federation:post` / `interact` / `channel` / `room` / `ring`。
  同时去掉代码里从没用到的 `ui:theme` 与 `media:read`。
- 删掉与 `page.css` 逐字节相同的 `styles.css`（旧 `cssMode: separated` 的产物），
  安装包体积减少约 187 KiB。

### 1.0.56

- Chat: a confirmed send no longer shows as a sending/sent pair; the avatar sits on the last bubble of a burst
- Sidebar timestamps and group member counts refresh on their own; a late joiner receives the full room roster

### 1.0.39

- Feed: click post opens detail modal; list cards truncate with “Show more”

### 1.0.38

- Feed: quote/repost blocks show full body; click opens original post (no follow required)
- Host: `federation.getObject` for public object lookup

### 1.0.37

- E2E: prefer plaintext on poll/WS race; soft “decrypting” placeholder; multi-retry decrypt refresh
- Delivery: soft banner for partial/dead federation peers (not error toast)

### 1.0.36

- Inline composer icon styles (survive stale page.css on reinstall)

### 1.0.35

- Fix emoji button gray square plate — match attach (+) chrome

### 1.0.34

- Complete emoji panel: Unicode emoji categories + recent; stickers as secondary tabs
- Sticker messages render as compact bubbles; refresh room pack on open

### 1.0.33

- Edit/create group: avatar upload + invite policy; create form description field

### 1.0.32

- Fix sticker button not clickable; polish sticker panel to match Aro chrome
- Stickers also in attach menu; class-driven open + event delegation

### 1.0.31

- Fix store install 400 missing `page/stickers.js`: sticker UI lives in `attachments.js` (always in `download.modules`); drop the separate module.

### 1.0.30

- Add stickers **from chat images**: message menu “Add as sticker”, image viewer smile button
- Chooser: group pack vs mine (group chat); compresses inline `data:image` into the pack

### 1.0.29

- Composer **sticker entry** (smiley next to attach): panel with Group pack + Mine
- Group pack uses host `federation.addRoomSticker` / `removeRoomSticker` + WS `stickers_changed`
- Personal pack stored client-side (`aro.personal_stickers`); tap to send as image message
- Long-press / right-click: send, remove, or share personal sticker into the group pack

### 1.0.22

- Fix chat image bubbles that only showed the filename after 1.0.10: large
  inline `data:image/*` payloads (e.g. wallhaven photos under 2 MiB raw) were
  rejected by `safeIconUrl`'s 256 KiB icon cap. Use `safeMessageImageUrl` with
  a message-sized limit for image bubbles.

### 1.0.21

- Declare `network:fetch` so Myriad sandbox CSP allows remote https images
  (GitHub avatars, remote federation media, share-card covers) without
  host-origin proxy / domain whitelist.

### 1.0.11

- Security/architecture follow-up: thin core entry (headless notifications only); `page/*` is sole UI source
- Page files parse independently (`bindEvents` in views, `init` in page/index)
- History/files async guards; import size/schema caps; disposable listener bag; local-only DM privacy wording

### 1.0.9

- Messenger: move Accept / Reject / Join CTAs from chat header into a centered invite card in the conversation pane
- Soft primary Accept + outline Decline; open-join rooms use the same treatment

### 1.0.8

- Timeline: share affordance (compose text + optional X Web Intent; never server-side post)
- Following/followers: domain chip, mutual / follows-you badges, follow-back
- Feed density: tighter action row, absolute time title, actor-list skeleton
- Published tab: external share + absolute time title; follow-back in-flight guard
- Share copy feedback toasts (shareCopiedText / shareCopiedIntent)

### 1.0.7

- Settings: federation signing key rotate (confirm) via host bridge
- Settings: delivery queue list with per-item cancel/retry + bulk actions (confirm)

### 1.0.6

- Messenger / overlay / interaction polish

## Host bridge dependencies

| Aro feature | Host method | Permission | Notes |
|-------------|-------------|------------|-------|
| Key rotate (1.0.7) | `federation.rotateKeys(confirm)` | `federation:post` | Myriad PR #224 |
| External share (1.0.8) | `federation.composeExternalShare(req)` | `federation:read` | Myriad PR #225 — X Web Intent only |
| Share status (optional) | `federation.getExternalShareStatus()` | `federation:read` | Same PR; mode=`intent`, `can_post=false` |
| Room stickers (1.0.29) | `federation.addRoomSticker` / `removeRoomSticker` | `federation:room` | Myriad ≥ v0.3.14; pack in `shared_data_config.stickers` |

If `composeExternalShare` is missing, Aro falls back to a local `https://x.com/intent/tweet` URL. **Myriad never posts to X server-side.**

## 包结构

```
core.js              # core 层入口（headless 后台通知轮询，唯一常驻代码）
page.html / page.css # page 层模板与作者样式
page/index.js        # page 层入口：按依赖顺序 require 同层文件，然后 init
page/scope.js        # 层内共享作用域（把跨文件的名字挂回沙箱全局）
page/*.js            # UI 真源，由 page/index.js 的 require 闭包拉入
i18n/{zh,en,ja}.json
manifest.json        # version 1.1.0
```

层入口由 manifest 的 `core.entry` / `page.entry` 声明；层内其余文件不进 manifest，
由入口用相对 `require` 引用，宿主按闭包下发与隔离。
