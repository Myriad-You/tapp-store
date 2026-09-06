# Wiki

面向 Myriad 公开访客、登录用户与管理员的安装级共享知识库。普通访问者始终只读；installation owner 与当前管理员通过 `Tapp.user.isAdmin()` 获得管理界面，服务端再对每次 `Tapp.shared` 写入执行 owner/admin 鉴权。

## Phase 1 能力

- 树形目录、标题/摘要/标签/正文搜索、文章空态与单正文读取失败提示
- 管理员创建、编辑、显式发布、取消编辑、删除与手动刷新
- 当前管理员私有的 Markdown 草稿，约 1 秒防抖自动保存，内容未变化时不重复写入
- 安全 Markdown AST → DOM 渲染；不执行原始 HTML，不使用不可信 `innerHTML`
- 外链只显示为可复制 HTTPS 地址，不提供任意导航能力；异步剪贴板受限时回退到临时只读文本选择
- HTTPS 图片与视频；视频固定 `controls`、`preload="metadata"`、不自动播放
- 媒体权限不可用或加载失败时显示占位、说明和原始 URL，正文保持可读
- Markdown 导入/导出与 JSON 全量备份/恢复；导入始终由管理员主动触发
- 70% / 85% / 95% owner 总用量提示、6 MiB 产品软预算与发布临时空间预留
- 中、英、日三语；亮/暗主题变量、安全区域、响应式、键盘焦点与 reduced motion

## 共享数据模型

| Key | 归属 | 用途 |
| --- | --- | --- |
| `wiki:event:v2:<revision>:<id>` | `Tapp.shared` | 单篇不可变的发布版本或删除墓碑 |
| `wiki:batch:v2:<batch-id>` | `Tapp.shared` | JSON 全量恢复在首篇写入前建立的 pending 意图，完成后切换为原子可见标记 |
| `wiki:abort:v2:<batch-id>` | `Tapp.shared` | 写入方失败或管理员清理时建立的永久小型终止墓碑；在读模型中优先于 commit |
| `wiki:catalog:v1` / `wiki:article:*` | `Tapp.shared` | 仅用于兼容读取 v0.1.2 及更早版本的数据 |
| `wiki:draft:<id>` | `Tapp.storage` | 当前 subject 的私有草稿 |
| `wiki:recovery:v1` | `Tapp.storage` | 当前管理员看到的失败写入恢复线索 |

单篇发布和删除都只新增一个不可变事件，不执行“先读目录、再覆盖目录”的易丢失更新流程；同一文章按从已观察最大值递增的 Lamport 逻辑时钟和唯一 revision 确定最新可见版本，不依赖管理员设备的本地时间，不同文章的并发发布互不覆盖。Slug 只是显示与导出文件名提示，不承担身份或路由，因此稳定 `id` 才是文章唯一标识。

JSON 全量恢复在写第一篇前先写共享 pending 意图，再写带同一 `batchId` 的文章事件，最后把意图切换为列出完整事件 key 的 commit；读者只把最新的完整批次作为整体基线，再叠加逻辑顺序严格晚于该批次的单篇事件。缺少任一事件的 commit 不会部分生效。提交失败时写入方先写独立 abort 证据再回收；即使 Page 在逐篇写入或清理中崩溃，任意管理员仍能从共享 pending/abort 继续安全回收。管理员手动清理也会明确终止其他会话尚未完成的恢复批次；abort 在读模型中优先于迟到 commit。回收完成后 abort 会把 `eventKeys` 压缩为空数组，但按 `batchId` 永久保留，防止结果不确定的旧请求迟到落库后重新激活批次。私有 recovery 只是当前 Page 的尽力重试提示，不承担跨 Page/设备一致性或跨崩溃安全职责。

单正文在产品层限制为 768 KiB，低于存储单值 1 MiB 硬上限。发布预检按 owner 命名空间 8 MiB 总额度计算，并额外保留 256 KiB 临时空间；这部分额度同时可能被 settings、credentials 与 owner storage 使用，因此 6 MiB 只是 Wiki 自身的软预算，不是新的宿主硬限制。

## Markdown 与媒体

支持标题、段落、有序/无序列表、引用、分隔线、围栏代码、行内代码、粗体、斜体、链接及 Markdown 图片语法。原始 HTML 作为文本显示。

媒体写法仍使用 Markdown 图片语法，文件扩展名决定渲染类型：

```markdown
![架构图](https://cdn.example.com/architecture.webp)
![演示视频](https://cdn.example.com/demo.webm)
```

图片只接受 `avif/gif/jpeg/jpg/png/svg/webp`，视频只接受 `m4v/mov/mp4/ogv/webm`，且必须是无用户名/密码的绝对 HTTPS URL。应用不调用 `fetch`、XHR、WebSocket，也不上传联邦媒体。

## 权限

| 权限 | 用途 |
| --- | --- |
| `storage:read` | 读取共享正文、私有草稿与用量；调用 `Tapp.file.download` |
| `storage:write` | 管理员私有草稿和 owner/admin 共享发布 |
| `ui:confirm` | 覆盖、删除、备份恢复与孤儿清理确认 |
| `ui:notification` | 操作结果提示 |
| `network:fetch` | 允许沙箱加载远程 HTTPS 图片/视频；游客是否可用取决于站点动态授权 |

没有声明 `ui:openUrl` 与 `openUrls`。外部地址只可复制，不会打开新窗口或跳转。

## 生命周期与刷新

当前生成的 `tapp-sdk.d.ts` 没有 `Tapp.shared.onChanged`，因此 Wiki 不依赖该文档方法。Page 首次进入、宿主 `onResume` 与用户点击刷新时重新读取共享事件；较慢的旧刷新结果不能覆盖较新的快照。草稿写入按修订号串行化，发布、删除与关闭编辑器前先等待队列收束，`onDestroy` 在取消 locale 订阅和计时器前尽力提交最后一份未保存草稿。

## 自动验证

在仓库根目录运行：

```powershell
& 'D:\SDK\NodeJS\node-versions\v24.16.0\installation\node.exe' --test 'apps/cn.echootaku.wiki/tests/*.test.cjs'
& 'D:\SDK\NodeJS\node-versions\v24.16.0\installation\node.exe' scripts/validate-app.mjs --app cn.echootaku.wiki
& 'D:\SDK\NodeJS\node-versions\v24.16.0\installation\node.exe' scripts/validate-previews.mjs --app cn.echootaku.wiki
& 'D:\SDK\NodeJS\node-versions\v24.16.0\installation\node.exe' scripts/sync-index.mjs validate --app cn.echootaku.wiki
```

自动校验和 `.tapp` 打包不等于真实 Myriad 验收。提交前仍需在真实宿主分别验证管理员、普通登录用户、已签名访客与公开游客，并确认游客动态 `network:fetch` 策略下的媒体降级行为。
