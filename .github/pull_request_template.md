## 变更说明

<!-- 简要说明这个 PR 做了什么 -->

## 类型

- [ ] 新应用（`apps/<id>/`）
- [ ] 更新已有应用（版本 / 功能 / 修复）
- [ ] 文档或脚本
- [ ] 其他

## 检查清单

- [ ] **没有修改** 根目录 `index.json`（禁止手改；合并后由 bot 从 manifest 自动对齐）
- [ ] 只改了 `apps/<id>/` 包内容（或文档 / 脚本）
- [ ] `manifest.json` 的 `id` 与文件夹名一致
- [ ] 版本号已按需 bump（`manifest.version`）
- [ ] `category` 使用稳定 ID：`ai` / `data` / `developer` / `game` / `media` / `productivity` / `social` / `utility`
- [ ] Manifest 声明的入口、`pageTemplate` / `pageStyles` / widget 模板等文件都在包内
- [ ] 本地可跑：`node scripts/sync-index.mjs validate`
- [ ] 若有 `preview`：`node scripts/validate-previews.mjs`（合并后 index 对齐时也会跑）

## 对齐说明

安装相关字段以 **`apps/<id>/manifest.json` 为准**。  
`index.json` 的 `version` / `category` / `permissions` / `download` 等会在合并到 `main` 后由 `scripts/sync-index.mjs` 自动重写。

商店展示专用字段（`long_description`、`tags`、`featured`、`preview` 等）在已有条目上会保留；新应用首次收录时由 bot 生成基础条目。
