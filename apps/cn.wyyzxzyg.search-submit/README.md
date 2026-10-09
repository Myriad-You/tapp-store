# 搜索引擎收录提交

面向 Myriad 站点管理员的搜索引擎 URL 主动提交工具。

作者：**我願一直向著陽光.℡**

## 功能

- 百度搜索资源平台主动推送
- IndexNow 批量 URL 提交
- 保存站点与凭证配置
- URL 去重与同站点校验
- 提交前确认 URL 数量并提示被忽略的无效地址
- 自定义 IndexNow Key 文件位于子目录时，仅提交该目录范围内的 URL
- 按百度实际响应显示成功数、拒绝数与剩余额度
- 远端提交与本地日志相互隔离，日志写入失败不会误报提交失败
- 保存提交结果日志
- 仅管理员可访问配置和提交界面
- 点击直接打开百度 Token 获取页面与 IndexNow Key 指南
- 跳转失败时自动复制官方地址
- **定时提交**：按间隔或每天固定时间自动冲刷待提交队列（`Tapp.scheduler`，headless core 常驻）
- **待提交队列**：手动攒下 URL，到点自动送出；也可让自动发现只收集不提交
- **手账文章自动提交**：读取 Myriad 手账（Phantasi，`Tapp.phantasiList`）订阅源文章，
  按站内阅读页地址模板生成 URL 并自动推送（默认 `/journal/articles/{id}`，模板可配置）
- **来源自动扫描**：解析 sitemap.xml / sitemapindex / robots.txt / RSS / Atom / OPML / 商店 index.json
- **增量去重**：只提交首次出现的 URL；首次运行只建立基线，不会全量推送

## 使用说明

1. 选择百度主动推送或 IndexNow。
2. 点击配置区域的官方指南按钮获取 Token 或 Key。
3. 填写站点地址和凭证并保存。
4. 输入需要提交的完整 URL，每行一个，然后提交。

使用 IndexNow 时，需要在站点根目录部署 `{Key}.txt`；如果 Key 文件不在根目录，请填写同一站点下的完整 Key 文件地址。

主动提交不代表搜索引擎一定收录。凭证保存在当前管理员的私有 Tapp 存储中。

## 定时提交

在「03 定时提交」中启用定时任务并保存配置：

| 触发方式 | 说明 |
| --- | --- |
| 按间隔 | 每 N 分钟执行一次（5–1440，默认 360） |
| 按每天固定时间 | 每天 `HH:MM` 执行一次（本地时区） |

任务以 `executionTarget: "frontend"` 注册，并声明 `backgroundRequirements: ["scheduler"]`，
因此页面关闭后仍由 headless core 执行。每次触发会先冲刷待提交队列，再执行一次自动发现。

调度回调执行前会重新确认管理员身份；非管理员直接跳过，不读取配置也不出站。

## 自动发现新增链接

在「04 自动发现新增链接」中开启后可配置：

- **扫描 Myriad 手账订阅源文章**：`phantasiList.list()` 返回的 `link` 是**原文站外地址**
  （它来自订阅源，不是本站自己发布的笔记；宿主没有列出站内笔记的只读 Tapp API）。
  因此用「站内文章地址模板」从 `id` 生成站内阅读页地址后提交。
  模板占位符：`{id}`、`{link}`、`{url}`、`{title}`、`{date}`、`{source}`；
  `link`/`url` 原样替换，其余做 `encodeURIComponent`。默认 `/journal/articles/{id}`。
  最终 URL 仍经过同站点过滤，站外原文（`{link}`）会被丢弃，不会提交给搜索引擎。
  宿主未提供 `phantasiList`、未授予 `phantasi:read` 或读取失败时只记日志，不影响其它来源。
- **扫描自定义来源**：每行一个 URL，最多 10 个，每轮最多实际抓取 10 次。
  来源地址必须是 HTTPS 且不含空白或花括号。通用提取器按**根元素语义**区分
  「要提交的页面」与「还要继续抓的子 sitemap」：
  - `<urlset>` 的 `<loc>` → 页面
  - `<sitemapindex>` 的 `<loc>`、`robots.txt` 的 `Sitemap:` 指令 → 子 sitemap，**继续抓取，不会当成页面提交**
  - RSS 2.0 的 `<link>` 文本、Atom 条目的 `<link href>` / `<id>` / `<guid>` → 页面（跳过 `rel=self|next|prev|first|last` 导航链接）
  - OPML 的 `url=` 属性、JSON 目录按 `url` / `link` / `permalink` / `href` / `loc` / `homepage` / `website` / `site_url` / `canonical` 递归取值 → 页面

  因此商店 `index.json` 更新后新增的应用主页也会被收集。
- **发现到新链接时**：`直接提交` 或 `加入待提交队列`。

所有候选 URL 都会经过与手动提交相同的过滤：必须是 HTTPS、必须同站点，
IndexNow 自定义 Key 文件时还必须落在 Key 授权目录内。HTML 实体（`&amp;`）会先解码。

**首次运行只建立基线**（记录当前全部候选 URL 而不提交），之后每轮只推送首次出现的 URL。
基线只做一次：用一次性标记记录，即使首轮扫到 0 条，之后真正出现的内容也会被正常提交，
不会反复重建基线把内容吞掉。想重来可用「清空去重记录」；**修改站点地址也会自动重置基线与去重记录**。

去重记录同时按条数（1500）与序列化字节（480 KiB）裁剪，
以避开宿主 `Tapp.storage` 单值 1 MiB 的硬上限。

## 定时与自动发现的边界

- 定时任务与自动发现都只在**管理员**上下文执行；调度回调每次触发都会重新确认身份。
- 单个来源抓取失败只记入日志，不影响其它来源，也不中断整轮流程。
- 队列里过不了校验（非 HTTPS / 非本站 / 超出 Key 目录）的条目会在冲刷时被移除并记日志，
  不会每轮静默重试。
- `自动发现` 关闭时，定时任务仍会正常冲刷待提交队列。

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

## 系统版本

`phantasi:read`（`Tapp.phantasiList`）与 `scheduler:register` 依赖 0.6.x 宿主，
`minSystemVersion` 声明为 `0.6.2`，旧宿主不会安装本版本。

## 本地校验

```bash
node scripts/validate-app.mjs --app cn.wyyzxzyg.search-submit
node scripts/validate-previews.mjs --app cn.wyyzxzyg.search-submit
node tapp-cli/bin/myriad-tapp.mjs check apps/cn.wyyzxzyg.search-submit --json
node --test apps/cn.wyyzxzyg.search-submit/tests
```

## 更新日志

### v1.1.0

- 新增定时提交：按间隔 / 每天固定时间在 headless core 中自动执行
- 新增待提交队列，手动与自动发现共用
- 新增自动发现：Myriad 手账订阅源文章（默认按 `/journal/articles/{id}` 拼站内阅读页，模板可配置）
  + sitemap / robots.txt / RSS / 商店 index.json
- 新增增量去重记录与首次运行基线（基线只做一次，改站点自动重置）
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
