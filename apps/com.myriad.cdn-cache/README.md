# CDN 缓存刷新

集中管理 Cloudflare、腾讯云 EdgeOne 与阿里云 CDN 的缓存刷新任务。

作者：**我願一直向著陽光.℡**

## 版本

`1.0.0`

## 功能

- **多 CDN 支持**：在同一页面切换 Cloudflare、EdgeOne 与阿里云 CDN
- **精确刷新**：按行输入完整 URL，批量提交缓存刷新任务
- **全站清理**：二次确认后清理站点全部缓存
- **角色隔离**：管理员使用运维控制台；游客和普通用户只看到只读状态页
- **配置隔离**：只显示当前服务商所需配置，凭证保存在当前用户私有存储
- **安全日志**：记录任务结果，不记录 Token、SecretId、SecretKey 或 AccessKey
- **重复保护**：5 秒内阻止相同刷新请求重复提交
- **通知兜底**：同时调用宿主通知桥与页面内 Toast，桥接失败时仍显示操作结果
- **主题适配**：跟随 Myriad 深色与浅色主题

## 服务商配置

| 服务商 | 必填配置 | 全站清理方式 |
| ------ | -------- | ------------ |
| Cloudflare | Zone ID、API Token、站点地址 | `purge_everything` |
| 腾讯云 EdgeOne | Zone ID、SecretId、SecretKey、站点地址 | `purge_all` |
| 阿里云 CDN | AccessKey ID、AccessKey Secret、站点地址 | 根目录 `Directory` 刷新 |

### Cloudflare

创建仅包含目标 Zone 且拥有 `Zone / Cache Purge / Purge` 权限的 API Token。不要使用 Global API Key。

### 腾讯云 EdgeOne

使用仅具备目标站点 `CreatePurgeTask` 权限的 CAM 子用户密钥。插件将同一个 payload 对象用于 TC3 哈希与 Myriad 声明式 JSON 出站，并以宿主实际的 `application/json` 参与签名；提交前还会把 URL 规范化为 ASCII。

### 阿里云 CDN

使用仅具备 `cdn:RefreshObjectCaches` 权限的 RAM 用户 AccessKey。按 URL 刷新使用 `File` 类型。

## 使用方法

1. 选择 CDN 服务商。
2. 填写当前服务商所需凭证与站点地址。
3. 点击“保存配置”。
4. 每行输入一个需要刷新的完整 URL，然后点击“刷新这些 URL”。
5. 如需清理全部缓存，点击“清理全站缓存”并确认操作。
6. 在刷新日志中查看提交结果。

## 权限说明

| 权限 | 用途 |
| ---- | ---- |
| `network:fetch` | 通过 Myriad 声明式 API 请求 CDN 官方接口 |
| `storage` | 保存当前用户的配置、日志与防重复状态 |
| `ui:confirm` | 全站清理、清空日志和清除密钥前二次确认 |
| `ui:notification` | 显示成功、警告与错误消息 |
| `ui:theme` | 适配 Myriad 明暗主题 |

## 安全

- CDN 凭证仅保存在当前登录用户的 Tapp 私有存储中。
- 凭证不会写入安装包、商店索引或刷新日志。
- 错误信息会隐藏 Bearer Token 和常见 AccessKey 标识。
- 建议为每个服务商创建遵循最小权限原则的独立子账号或 Token。
- 不建议使用主账号密钥、Cloudflare Global API Key 或拥有管理全部资源权限的凭证。

## 架构

```text
com.myriad.cdn-cache/
├── manifest.json  # 应用信息、权限和 CDN API 声明
├── main.js        # 配置、阿里云签名、刷新与日志逻辑
├── page.html      # 页面模板
├── page.css       # 页面样式与服务商配置互斥显示
└── README.md      # 使用说明
```

## 限制

- 当前版本仅提供手动刷新。Myriad 尚未向 Tapp 开放文章、页面或评论变更事件，暂时无法实现内容更新后自动刷新。
- 插件提交的是异步 CDN 刷新任务；实际生效时间取决于服务商。
- 全站清理可能造成大量请求回源，请谨慎使用。

## 管理员访问控制

- 页面启动时通过 `Tapp.user.getRole()` 与 `Tapp.user.isAdmin()` 双重确认管理员身份。
- 非管理员不会读取配置与日志，也不会绑定任何运维按钮。
- 保存凭证、清除凭证、提交刷新和清空日志前会再次实时校验管理员身份。
- 角色查询失败时默认拒绝访问，避免降级为开放模式。
- 管理员判断是页面侧门禁；声明式 API 的 `protected` 仅要求登录，真正的出站授权仍由 elevated `network:fetch` Runtime Grant 与 CDN 凭证共同决定。
- Myriad 当前不支持 API 级 `admin` access；请勿将普通用户加入 `user_perm_network_fetch`，也不要向普通用户提供站点 CDN 凭证。

## 更新日志

### v1.0.0 (2026-08-01)

- 重构 EdgeOne TC3：同一 payload 对象参与签名与声明式出站，Content-Type 对齐为 `application/json`
- URL 在 EdgeOne 签名前规范化为 ASCII，避免非 ASCII JSON 转义差异
- AWS CloudFront 因宿主不支持 raw XML body，当前不提供
- 刷新操作始终读取当前表单配置，避免误用旧的已保存配置
- 明确管理员 UI 门禁、Runtime Grant 与 CDN 凭证的安全边界
- 增加管理员与非管理员双界面
- 游客和普通用户只显示安全的只读状态页
- 支持 Cloudflare、腾讯云 EdgeOne 与阿里云 CDN
- 支持按 URL 刷新和全站缓存清理
- 支持 EdgeOne TC3-HMAC-SHA256 与阿里云 RPC HMAC-SHA1 签名
- 增加私有配置、刷新日志、二次确认与 5 秒重复请求保护
