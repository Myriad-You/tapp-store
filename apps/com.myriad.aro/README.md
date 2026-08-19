# Aro

社交中心：消息（Channel/Room）、时间线、环网与个人资料。

> 官方社交 Tapp（version 1.0.39）。设置页含出站投递队列与联邦签名密钥轮换（需宿主 `federation.rotateKeys`）。

## 功能

- 联邦消息 / 房间 / 关注 / 时间线 / 环网
- 聊天输入区 **表情/贴纸**：群共享贴纸包（宿主 `addRoomSticker` / `removeRoomSticker`，Myriad ≥ v0.3.14）+ 本机「我的」贴纸
- 出站投递列表：刷新 / 单项取消·重试 / 全部取消·重试失败
- 联邦签名密钥显式轮换（确认后 `rotateKeys(true)`）
- 后台轮询新消息通知（`backgroundRequirements: notification`）
- 中英日 i18n

## 权限

`storage`, `ui:notification`, `ui:theme`,
`federation:read|write|message|files`,
`platform:read`, `report:read`, `tappList:read|manage`, `brew:read`,
`media:control|read`, `network:fetch`

> `network:fetch`：宿主沙箱将远端 `https` 图/媒体挂在此权限上（头像、封面、联邦附件直链）。
> 为 **elevated**；已安装实例更新时需重新授权该权限（否则只保留旧 granted 交集）。

# Aro

社交中心：消息（Channel/Room）、时间线、环网与个人资料。

> 官方社交 Tapp（version 1.0.39）。设置页含出站投递队列与联邦签名密钥轮换（需宿主 `federation.rotateKeys`）。

## 功能

- 联邦消息 / 房间 / 关注 / 时间线 / 环网
- 聊天输入区 **表情/贴纸**：群共享贴纸包（宿主 `addRoomSticker` / `removeRoomSticker`，Myriad ≥ v0.3.14）+ 本机「我的」贴纸
- 出站投递列表：刷新 / 单项取消·重试 / 全部取消·重试失败
- 联邦签名密钥显式轮换（确认后 `rotateKeys(true)`）
- 后台轮询新消息通知（`backgroundRequirements: notification`）
- 中英日 i18n

## 权限

`storage`, `ui:notification`, `ui:theme`,
`federation:read|write|message|files`,
`platform:read`, `report:read`, `tappList:read|manage`, `brew:read`,
`media:control|read`, `network:fetch`

> `network:fetch`：宿主沙箱将远端 `https` 图/媒体挂在此权限上（头像、封面、联邦附件直链）。
> 为 **elevated**；已安装实例更新时需重新授权该权限（否则只保留旧 granted 交集）。

## Changelog

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

- Fix store install 400 missing `page/stickers.js`: sticker UI lives in `attachments.js` (always in download.page_modules); drop separate pageModule.

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

- Security/architecture follow-up: thin `index.js` (headless notifications only); `page/*` is sole UI source
- pageModules files parse independently (`bindEvents` in views, `init` in page/index)
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
| Key rotate (1.0.7) | `federation.rotateKeys(confirm)` | `federation:write` | Myriad PR #224 |
| External share (1.0.8) | `federation.composeExternalShare(req)` | `federation:read` | Myriad PR #225 — X Web Intent only |
| Share status (optional) | `federation.getExternalShareStatus()` | `federation:read` | Same PR; mode=`intent`, `can_post=false` |
| Room stickers (1.0.29) | `federation.addRoomSticker` / `removeRoomSticker` | `federation:write` | Myriad ≥ v0.3.14; pack in `shared_data_config.stickers` |

If `composeExternalShare` is missing, Aro falls back to a local `https://x.com/intent/tweet` URL. **Myriad never posts to X server-side.**

## 包结构

```
index.js          # core（background + 内嵌 i18n 回退）
page.html / page.css / styles.css
page/*.js         # pageModules（UI 真源）
i18n/{zh,en,ja}.json
manifest.json     # version 1.0.39
```
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

- Fix store install 400 missing `page/stickers.js`: sticker UI lives in `attachments.js` (always in download.page_modules); drop separate pageModule.

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

- Security/architecture follow-up: thin `index.js` (headless notifications only); `page/*` is sole UI source
- pageModules files parse independently (`bindEvents` in views, `init` in page/index)
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
| Key rotate (1.0.7) | `federation.rotateKeys(confirm)` | `federation:write` | Myriad PR #224 |
| External share (1.0.8) | `federation.composeExternalShare(req)` | `federation:read` | Myriad PR #225 — X Web Intent only |
| Share status (optional) | `federation.getExternalShareStatus()` | `federation:read` | Same PR; mode=`intent`, `can_post=false` |
| Room stickers (1.0.29) | `federation.addRoomSticker` / `removeRoomSticker` | `federation:write` | Myriad ≥ v0.3.14; pack in `shared_data_config.stickers` |

If `composeExternalShare` is missing, Aro falls back to a local `https://x.com/intent/tweet` URL. **Myriad never posts to X server-side.**

## 包结构

```
index.js          # core（background + 内嵌 i18n 回退）
page.html / page.css / styles.css
page/*.js         # pageModules（UI 真源）
i18n/{zh,en,ja}.json
manifest.json     # version 1.0.39
```
