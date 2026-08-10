# GitHub 工作台

GitHub 工作台是面向 Myriad 管理员的只读开发看板。它把请求你审阅的 Pull Request、分配给你的 Issue、所选仓库失败的 Actions 与 Releases 汇总到一个页面，并将最近一次成功同步的统计保存给桌面小组件。

## 配置

1. 在 GitHub 创建 fine-grained personal access token。
2. 选择需要纳入工作台的仓库，并只授予以下 Repository permissions：
   - Metadata: Read-only（GitHub 自动包含）
   - Pull requests: Read-only
   - Issues: Read-only
   - Actions: Read-only
   - Contents: Read-only（读取私有仓库 Releases）
3. 在 Myriad 的 Tapp 详情页，将令牌写入 `GitHub Personal Access Token` 凭据。
4. 安装 owner 或管理员打开页面，点击“同步 GitHub”。

如果使用 classic PAT，私有仓库通常需要 `repo`；本应用不依赖通知接口，因此不需要 `notifications` scope。建议优先使用权限更细的 fine-grained PAT。

## 安全边界

- 凭据由宿主加密保存，只会附加到 Manifest 中固定 `https://api.github.com` origin 的声明式 API；Tapp JavaScript 无法读取令牌。
- 所有 GitHub API 都是 `GET` 且 `access: manager`，普通用户和游客无法调用。
- 页面仅通过宿主声明的 `github.com` allowlist 打开外链。
- 外部数据只通过 DOM `textContent` 写入页面，不作为 HTML 注入。
- 同步失败时保留最近一次成功快照，并明确显示数据时间；不会用失败响应覆盖可信快照。

## 当前范围

- 请求我审阅的开放 PR
- 分配给我的开放 Issue
- 选择一个仓库查看失败 Actions 与 Releases
- 2x2、4x2、4x4 概览小组件
- 中文、英文、日文界面

首版不包含 GitHub 通知、合并/评论/关闭操作、工作流重跑和后台自动同步。
