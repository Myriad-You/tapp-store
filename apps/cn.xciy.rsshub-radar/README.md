# RSSHub 雷达

面向 Myriad TApp 沙箱的 RSSHub Radar 移植版。输入公开网页地址后，从内置 Radar 规则中匹配 RSSHub 路由，生成订阅地址并预览 Feed。

## 功能

- 内置 1,270 个站点、5,201 条 RSSHub Radar 规则
- 根据 URL 匹配当前页面路由，并列出网站的其他可用路线
- 生成官方或自建 RSSHub 实例地址
- 通过固定的 `rsshub.app` Manifest API 预览 RSS / Atom 内容
- 缓存最近 12 条成功预览，实时服务失败时自动回退（缓存最长保留 7 天）
- 收藏路线、保存最近扫描记录，并将收藏导出为 OPML
- 生成 Feedly、Inoreader、Follow、FreshRSS、Miniflux 等阅读器订阅链接
- 跟随 Myriad 明暗主题，支持移动端布局和减少动态效果偏好

## 与浏览器扩展版的差异

TApp 不具有浏览器扩展的 `tabs`、内容脚本或任意 URL 请求能力，因此本应用：

- 不会自动读取当前标签页
- 不会访问宿主页面 DOM、Cookie 或浏览记录
- 不能自动扫描任意网页里的 `<link rel="alternate">`
- 使用用户主动输入的 URL 进行静态 Radar 路由匹配
- Feed 预览仅访问 Manifest 固定声明的 `https://rsshub.app`

## 能否替代 rsshub.app

本 TApp 可以集成 Radar 的路线发现、订阅链接生成、收藏、OPML 导出和轻量 Feed 阅读，但不能在当前沙箱中替代 RSSHub 服务端。Radar 规则只描述“网页 URL 如何映射为 RSSHub 路由”，并不包含路线背后的抓取实现。

完整 RSSHub 还需要 Node.js 运行时、数千个站点抓取器、缓存、Cookie/鉴权和部分浏览器自动化。TApp 的网络请求必须在 Manifest 中预先声明固定 HTTPS origin，不能让路线按需访问任意第三方站点。因此完整架构仍是：

```text
RSSHub Radar TApp -> 固定声明的 RSSHub 服务 -> 目标网站
```

输入框中的自建实例目前用于生成和导出订阅地址。选择自建实例后，应用会阻止预览请求，不会静默回退到 `rsshub.app`。若要让任意自建实例同时承担应用内预览，需要先由 TApp 平台提供用户授权的动态 origin allowlist，或在安装时绑定固定服务地址。

## 权限

| 权限 | 用途 |
| --- | --- |
| `storage` | 保存收藏、最近扫描、预览缓存和 RSSHub 实例设置，并导出 OPML |
| `network:fetch` | 通过声明式 API 请求 `rsshub.app` Feed 预览 |
| `ui:notification` | 显示复制、收藏和错误提示 |
| `ui:theme` | 跟随 Myriad 明暗主题 |

## 规则资产

上游 `radar-rules.ts` 大于 1 MiB。为避免 TApp Bridge 默认消息上限，构建脚本使用 TypeScript AST 读取纯字面量规则，并按域名首字符拆成 36 个 JSON 资产。运行时只加载输入 URL 可能涉及的分片。

重新生成规则：

```bash
npm install
npm run build:rules -- /path/to/RSSHub-Radar/src/lib/radar-rules.ts assets/rules
```

## 许可

应用移植代码及随包规则数据按 **GNU AGPL-3.0** 发布。

规则与原始实现来源：<https://github.com/DIYgod/RSSHub-Radar>  
完整上游许可文本：`assets/RSSHub-Radar-LICENSE.txt`
