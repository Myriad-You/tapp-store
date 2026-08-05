## 变更说明

<!-- 简要说明这个 PR 做了什么 -->

## 类型

- [ ] 新应用（`apps/<id>/`）
- [ ] 更新已有应用（版本 / 功能 / 修复）
- [ ] 文档或脚本 / CI
- [ ] 其他

## 检查清单

- [ ] **一次 PR 只改一个 app**（`apps/<id>/`；多 app 请拆 PR）
- [ ] **没有修改** 根目录 `index.json`
- [ ] 非 README 类改动已 **bump `manifest.version`**（semver 升高）
- [ ] `manifest.id` 与文件夹名一致
- [ ] `category` 为稳定 ID：`ai` / `data` / `developer` / `game` / `media` / `productivity` / `social` / `utility`
- [ ] 商店展示文案（如需）写在 `apps/<id>/catalog.json`，不在 index
- [ ] 敏感权限（federation / platform / tappList:manage 等）已审阅，`catalog.securityReview: true`（`com.myriad.*` 除外）
- [ ] 本地：

```bash
node scripts/check-pr-scope.mjs
node scripts/validate-app.mjs --app <id>
node tapp-cli/bin/myriad-tapp.mjs check apps/<id> --json
node scripts/validate-previews.mjs --app <id>
```

## 对齐说明

安装字段以 **`manifest.json` 为准**；合并后 bot 会重写 `index.json` 的 version / category / permissions / download / size 等。  
展示字段以 **`catalog.json`**（可选）为准，否则保留原 index 条目或用 description 引导。
