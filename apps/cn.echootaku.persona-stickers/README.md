# 人设表情工坊

人设表情工坊是一款 Page Tapp：它以用户已经启用并生成图片的 Agent 人设为角色身份基准，通过 Emoji、颜文字或单张图片表情提示，生成一张独立的 PNG 表情图片。

## 使用流程

1. 调用 `Tapp.persona.get()` 读取 `enabled`、`name`、`moodBand`、`activity` 与 `portraitUrl`。
2. 若没有已启用且带有效人设图的 Agent，人设门控会阻止生成，并提示用户先在 Myriad 中创建并生成人设图。
3. 有可用人设后，用户从以下三种提示方式中选择一种：
   - Emoji：从预设中选择或输入一个自定义 Emoji。
   - 颜文字：从预设中选择或输入一个自定义颜文字。
   - 图片表情：上传且仅上传一张 PNG、JPEG 或 WebP，解码后不超过 10 MiB。
4. 用户还可以填写一段最多 800 字符的补充提示词。它在固定输出约束内拥有最高创意优先级，优先控制动作、表情、道具、构图和情绪强度，避免被模式提示稀释。
5. 每次任务固定生成一张 1024×1024、单角色、无文字和水印的 PNG 表情。当前图片模型不会生成 Alpha 通道；提示词也会阻止模型把棋盘格画进图片来伪装透明效果。

Emoji 与颜文字模式只把 Agent 人设图作为参考图。图片表情模式严格保持参考顺序：第 1 张是 Agent 人设图，用于固定身份与外观；第 2 张是用户上传的图片，仅用于表情、姿势和构图。

## 权限与数据边界

Manifest 仅申请 `ai:image`，用于图片任务。当前上游将 `Tapp.file.download()` 定义为公共宿主能力，因此下载不需要 `storage:read`；应用也不申请 `network:fetch`、Storage 写入或 Federation 权限。

本地图片通过 `FileReader.readAsDataURL()` 读取，并检查 MIME、文件签名、数量与解码后字节数。它只存在于当前 Page 内存，不写入 `Tapp.storage`，不做独立上传，也不进入包；点击生成后才作为该次 `Tapp.ai.tasks.create()` 的第二张 `input.referenceImages` 提交。

供应商若拒绝参考图，应用会保留原始错误码，不会移除人设图或表情参考图后静默降级为文生图。任务支持进度、取消、暂停/恢复和销毁清理；客户端等待上限为 315 秒。

## 缓存与下载边界

应用只接受同源 `/api/brew/image-cache/...png` 结果用于即时预览，并提供带 Escape、背景关闭、焦点循环、焦点返回和背景 `inert` 隔离的大图查看器。查看舞台使用中性实色底，不以棋盘格暗示结果含 Alpha 通道。

“下载 PNG”把已校验的同源缓存路径交给 `Tapp.file.download()`。Myriad 宿主负责读取当前图片缓存并把真实 PNG 字节保存到用户设备；Page 不直接 `fetch` 图片、不创建 Blob，也不使用下载链接绕过宿主治理。下载源限于当前任务返回并通过校验的 `/api/brew/image-cache/...png` 路径，宿主还会执行路径白名单与 32 MiB 上限检查。用户应在缓存有效时完成下载。

## 界面与可访问性

提供简体中文、英文、日文，支持浅色/深色、Myriad 主色、安全区域、窄屏布局、键盘焦点和减少动画偏好。三种模式是互斥单选；图片上传控件不允许多选。大图查看器支持关闭按钮、点击背景、Escape、焦点循环与关闭后的焦点返回。

## 开发验证

```powershell
$NODE = 'D:\SDK\NodeJS\node-versions\v24.16.0\installation\node.exe'
& $NODE --test apps/cn.echootaku.persona-stickers/tests/*.test.cjs
& $NODE scripts/validate-app.mjs --app cn.echootaku.persona-stickers
& $NODE scripts/validate-previews.mjs --app cn.echootaku.persona-stickers
& $NODE scripts/sync-index.mjs validate --app cn.echootaku.persona-stickers
& $NODE tapp-cli/bin/myriad-tapp.mjs check apps/cn.echootaku.persona-stickers --json
```

提交前的真实 Myriad 验收范围包括：无/有 Persona、三种提示方式、三语、浅深主题、窄宽屏、文件格式与大小边界、生成成功、取消、超时、供应商失败和生命周期清理。
