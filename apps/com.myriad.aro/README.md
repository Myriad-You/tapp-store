# Aro

社交中心：消息（Channel/Room）、时间线、环网与个人资料。

> 本包由 Myriad `frontend/src/tapp/examples/tapps/aro.ts` **逐字导出**（version 1.0.3）。

## 功能

- 联邦消息 / 房间 / 关注 / 时间线 / 环网
- 后台轮询新消息通知（`backgroundRequirements: notification`）
- 中英日 i18n

## 权限

`storage`, `ui:notification`, `ui:theme`,
`federation:read|write|message|files`,
`platform:read`, `report:read`, `tappList:read|manage`, `brew:read`

## 包结构

```
index.js          # core（与 aro.ts buildCoreCode() 一致）
page.html / page.css / styles.css
page/*.js         # pageModules 与 aro.ts PAGE_MODULES 一致
i18n/{zh,en,ja}.json
manifest.json     # version 1.0.3
```
