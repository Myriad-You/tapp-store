# 搜索引擎收录提交

面向 Myriad 站点管理员的搜索引擎 URL 主动提交工具，仅管理员可操作。

作者：**我願一直向著陽光.℡**

## 功能介绍

- **手动提交**：百度主动推送（支持成功/拒绝/剩余额度统计）与 IndexNow 批量提交，含 URL 清洗去重、同站点校验、提交前确认与本地日志。
- **定时提交**：按间隔或每天固定时间，在 headless core 中自动冲刷待提交队列（`Tapp.scheduler`，需 `scheduler:register`）。
- **自动发现**：可读取 Myriad 手账（Phantasi）订阅源文章（默认按 `/journal/articles/{id}` 拼站内阅读页，模板可配置；**默认关闭**，避免转载/重复内容风险），并可扫描 sitemap / robots.txt / RSS / 商店 index.json 等来源，只提交首次出现的 URL。

需要宿主版本 ≥ 0.6.2。

## 使用方法

1. 选择百度主动推送或 IndexNow，点击配置区域的官方指南按钮获取 Token 或 Key。
2. 填写站点地址和凭证，保存配置。
3. 输入需要提交的完整 URL（每行一个），点击「提交这些 URL」。
4. 需要自动执行时，在「03 定时提交」和「04 自动发现新增链接」面板开启并保存。

使用 IndexNow 时，需要在站点根目录部署 `{Key}.txt`；如果 Key 文件不在根目录，请填写同一站点下的完整 Key 文件地址。开启「扫描手账订阅源文章」时，文章地址模板必须以 `/` 或 `https://` 开头。

主动提交不代表搜索引擎一定收录。凭证保存在当前管理员的私有 Tapp 存储中。

## 权限说明

| 权限 | 用途 |
| --- | --- |
| `storage:read` / `storage:write` | 配置、日志、待提交队列与去重记录 |
| `phantasi:read` | 读取 Myriad 手账订阅源文章列表以发现新内容 |
| `scheduler:register` | 注册定时提交任务 |
| `network:fetch` | 百度 / IndexNow 推送，以及拉取自定义扫描来源 |
| `ui:notification` / `ui:confirm` / `ui:theme` / `ui:openUrl` | 通知、确认、主题与官方页面跳转 |

`fetchScanSource` 声明为 `access: "manager"` 的 `GET` API，仅管理员可用。
宿主在请求前会解析并钉扎全部公网 DNS 地址，禁止自动重定向、URL 内嵌凭据与
`Host`/`Connection` 等路由头，响应体上限 2 MiB。

> **注意**：`fetchScanSource` 的 `endpoint` 是整条 URL 模板 `"{{params.url}}"`，
> 由沙箱传入原始（未编码）地址，与 `baiduSubmit` 对 query 值做 `encodeURIComponent` 的写法不同——
> 宿主按字面量注入模板值。沙箱侧因此额外用 `validateSourceUrl` 挡住花括号、空白、
> 非 HTTPS 与内嵌凭据，防止破坏模板解析或请求结构。
>
> 它本质上是**管理员可控的任意公网 HTTPS GET**（`access: "manager"`，仅安装 owner /
> 当前管理员可调用；宿主侧有 SSRF 防护：解析并钉扎公网 DNS、禁自动重定向、无 URL 内嵌
> 凭据、响应体上限 2 MiB）。管理员自行填写的来源地址默认仍过滤为**本站同站点** URL 才会
> 提交，但抓取本身可以指向任何公网地址，请只配置可信来源。

## 更新日志

### v1.1.0

- 新增定时提交：按间隔 / 每天固定时间在 headless core 中自动执行
- 新增待提交队列，手动与自动发现共用
- 新增自动发现：Myriad 手账订阅源文章（默认按 `/journal/articles/{id}` 拼站内阅读页，模板可配置；**默认关闭**，避免转载/重复内容风险）
  + sitemap / robots.txt / RSS / 商店 index.json
- 新增增量去重记录与首次运行基线（基线只做一次，改站点自动重置）
- 文章地址模板保存时校验必须以 `/` 或 `https://` 开头
- 扫描按根元素语义区分页面与子 sitemap，不再把 sitemap 地址当页面提交
- RSS/Atom 解析覆盖 `<link>` 文本、条目 `<id>`，并跳过导航类 `rel` 链接
- URL 去重改为按归一化结果，避免 `example.com` 与 `example.com/` 重复提交
- 队列中的无效 URL 会被剔除并记录，不再每轮静默重试
- 去重记录按条数与字节双重裁剪，避开 storage 单值 1 MiB 上限
- minSystemVersion 提升至 0.6.2（phantasi:read / scheduler 依赖 0.6.x 宿主）
- 提交逻辑抽出为共用实现，手动、定时、自动三条路径行为一致
- 新增 tests/ 引擎级自动化测试（node --test）

### v1.0.0 (2026-08-06)

- 首次发布
- 支持百度主动推送和 IndexNow
- 支持安全链接跳转与复制兜底
- 支持 URL 清洗、提交确认、防重复提交和响应统计
- 支持 IndexNow Key 目录作用域校验和非关键日志写入
