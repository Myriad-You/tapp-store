# CDN 缓存刷新

## 简介

面向站点管理员的 CDN 缓存刷新工具，支持 Cloudflare、腾讯云 EdgeOne、阿里云 CDN 和 AWS CloudFront。可手动刷新指定 URL 或清理全站缓存，也可定期提交任务，或在「手帐」（Phantasi）内容源出现新文章、订阅源本身变化后自动刷新。凭证保存在当前用户的 Tapp 私有存储中。

## 使用说明

### 配置与手动刷新

1. 选择 CDN 服务商，填写站点 HTTPS 地址及对应凭证，然后点击“保存配置”。
   - Cloudflare：Zone ID、API Token。
   - EdgeOne：Zone ID、SecretId、SecretKey。
   - 阿里云 CDN：AccessKey ID、AccessKey Secret。
   - AWS CloudFront：Distribution ID、Access Key ID、Secret Access Key。
2. 每行输入一个完整 URL，点击“刷新这些 URL”；如需清理整站，点击“清理全站缓存”并确认。
3. 在刷新日志中查看任务提交结果。CDN 实际生效时间由服务商决定。

### 定期提交

在“定期提交与自动刷新”面板开启定期提交，设置间隔与提交范围：清理全站、刷新固定 URL 列表，或仅提交待处理队列。固定列表支持完整 URL 和以 `/` 开头的站内路径。最后点击“保存自动提交设置”。

### 内容变更自动刷新

在同一面板开启内容变更自动提交，设置核对间隔，并选择监听「手帐订阅源出现新文章」或「订阅源本身变更」。可设置文章路径模板、同时刷新首页、固定附加地址和单次 URL 上限，然后保存设置。

数据来自 `Tapp.phantasiList`（需要 `phantasi:read`）：

- `phantasiList.list()` 返回订阅源里的**文章**，其 `link` 是原文站外地址；文章在宿主里的正文页是站内阅读页 `/journal/articles/{id}`，所以默认模板就是它。
- `phantasiList.sources()` 只返回源元数据（id / name / url / item_count…），不含条目，因此「源变更」不产出文章地址，改为刷新站点首页与固定附加地址。
- 宿主目前**没有**列出「本站自己发布的笔记」的只读 Tapp API，也没有内容发布事件，所以两条链路共用同一次 `list()` 结果，不会重复计数。

首次核对默认只建立基线，不刷新已有内容；需要补刷时开启“首次运行时补刷”。未开启自动提交时，核对不会写任何状态（避免之后才开启时把安装以来的内容一次性刷掉）。面板也提供“立即核对一次”“立即提交队列”“立即清理全站”和“重置变更基线”。

## 权限

| 权限 | 用途 |
| --- | --- |
| `storage:read` / `storage:write` | 保存凭证、设置、队列与日志（仅当前登录用户） |
| `ui:notification` / `ui:confirm` / `ui:theme` | 结果提示、危险操作二次确认、跟随主题 |
| `network:fetch` | 调用四家 CDN 的刷新接口 |
| `scheduler:register` | 注册定期提交与内容变更核对任务（需要管理员登录） |
| `phantasi:read` | 读取手帐订阅源文章与源列表 |

`manifest.json` 的 `backgroundRequirements: ["scheduler"]` 会让宿主常驻执行 `core.js`，前台关闭后定时任务仍然工作。

## 架构

```
core.js        # 共享层 / headless 入口：配置、签名、提交、变更探测、调度注册（自启动）
page/index.js  # Page 入口
page/ui.js     # Page 界面层（管理员控制台、自动化面板）
tests/         # engine.test.mjs（共享层）、ui.test.mjs（jsdom 界面冒烟）
```

## 限制

- 当前宿主没有内容发布类事件（`system.*` 只有 theme、network、locale、visibility、navigation 五个环境主题），插件靠**增量核对**判断更新，不是事件推送。
- 定时任务由宿主推送执行；若站点没有任何打开的标签页，该次执行会被记为 `no_audience` 跳过且不补跑。
- 待提交队列上限 2000 条，按 FIFO 排队；队列满时先丢弃等待最久的旧条目，新探测到的内容不会被丢。
- 单次提交条数受各 CDN 套餐上限约束，插件按服务商取保守上限分批提交。
- 插件提交的是异步 CDN 刷新任务；实际生效时间取决于服务商。
- 全站清理可能造成大量请求回源，请谨慎使用。

## 更新日志

### v1.2.0

- 新增定期提交、内容变更自动刷新及后台任务支持。
- 支持文章路径模板、固定附加地址、队列及自动刷新日志。
- 内容变更探测统一走 `phantasiList`（宿主已硬切 Phantasi，`brew:*` / `Tapp.brewList` 会让安装校验 fail-closed）。
- 默认刷新站内阅读页 `/journal/articles/{id}`，避免站外原文地址被校验丢弃后只剩首页。
- 未开启自动提交时核对不再写状态，保证「首次开启只建立基线」。
- 启动核对加跨沙箱租约，避免 Page 与 headless 重复提交同一批 URL。
- `minSystemVersion` 提升到 0.6.2（`phantasi:read` 自 0.6.0 起提供）。
- 修复 RSS 源变化未触发刷新、条目读取、调度间隔更新、管理员启动门禁和失败响应判断。
- 清除凭证时同步关闭自动刷新与定期提交。

### v1.1.2

- 恢复商店展示文案来源，修正索引对齐。

### v1.1.0

- 新增 AWS CloudFront 刷新；收紧 CDN 接口的管理员访问控制。

### v1.0.0

- 支持 Cloudflare、EdgeOne 和阿里云 CDN 的指定 URL 刷新与全站清理。