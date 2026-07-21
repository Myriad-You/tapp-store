# Aro

社交中心：消息（Channel/Room）、时间线、环网与个人资料。

> 官方社交 Tapp（version 1.0.7）。设置页含出站投递队列与联邦签名密钥轮换（需宿主 `federation.rotateKeys`）。

## 功能

- 联邦消息 / 房间 / 关注 / 时间线 / 环网
- 出站投递列表：刷新 / 单项取消·重试 / 全部取消·重试失败
- 联邦签名密钥显式轮换（确认后 `rotateKeys(true)`）
- 后台轮询新消息通知（`backgroundRequirements: notification`）
- 中英日 i18n

## 权限

`storage`, `ui:notification`, `ui:theme`,
`federation:read|write|message|files`,
`platform:read`, `report:read`, `tappList:read|manage`, `brew:read`

## Changelog

### 1.0.7

- Settings: federation signing key rotate (confirm) via host bridge
- Settings: delivery queue list with per-item cancel/retry + bulk actions (confirm)

### 1.0.6

- Messenger / overlay / interaction polish

## 包结构

```
index.js          # core（background + 内嵌 i18n 回退）
page.html / page.css / styles.css
page/*.js         # pageModules（UI 真源）
i18n/{zh,en,ja}.json
manifest.json     # version 1.0.7
```
