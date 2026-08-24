# 回声剧场（Echo Stage）

回声剧场是运行在 Myriad 沙箱中的轻量网页视觉小说引擎。它不是 KRKR 的封装，也不会加载 KRKR 可执行文件；第一版定义了自己的 `echo-stage/v1` 游戏包和声明式 `.echo` 剧本格式。

回声剧场首先是本地游戏启动器：默认页面不选中或启动任何作品，主入口始终是用户主动选择本地游戏目录。目录只在当前 Page 会话中读取，游戏包中的 JavaScript 不会执行。

应用随包附带短篇《离岸之前》与《没有寄出的星图》，但它们只作为明确标注的“示例项目”卡片存在。只有用户点击对应卡片的“试玩”或“继续”后才会进入播放器，两部示例的存档继续按游戏 ID 隔离。

《没有寄出的星图》使用两张原创二次元场景：海边天文台的蓝调夜空，以及黎明前保存未寄信件的观测室。三种选择分别通往“抵达”“暗星”“新星图”，用于演示第二个游戏包、场景切换和按游戏 ID 隔离存档。

首页提供“下载开发示例”按钮。它会通过 Myriad 的宿主文件接口保存 `EchoStageDemo.tar`，解开后可直接选择其中的 `EchoStageDemo` 文件夹验证本地加载；归档内含最小 `game.json`、分支剧情和编辑说明，不依赖图片或音频素材。

## 余响工房

“AI 创作故事”进入同一 Tapp 内的在线编辑器。用户可以建立多个文字项目、填写故事想法和叙事气质，并通过 Myriad 受治理的 AI Task 生成结构化初稿。AI 返回内容始终按不可信文本处理：编辑器先收拢流式或结果式响应，再交给本地 `.echo` 解释器检查，符合契约后才能试玩。

编辑器还能按场景调用 Myriad 生图，固定输出 1344 × 768 的视觉小说横图。生成结果可以是宿主同源根路径或绝对 HTTPS URL；编辑器会把同源根路径安全归一化为 HTTPS 引用，保存在项目中并立即用于试玩。模型与供应商由 Myriad 选择，Tapp 不读取密钥，也不直接访问外部模型接口。

项目文字保存于当前账号的 Tapp Storage。导出的 TAR 含 `game.json`、`.echo`、场景提示词和云端 URL 记录；由于当前宿主下载 API 只接受 UTF-8 字符串，AI 图片不会伪装成已经嵌入的二进制文件，开发者需将图片另存到导出包声明的 `assets/*.png` 路径。

## 自动配音

播放器可通过 Myriad `Tapp.speech` 为当前对白自动生成语音。用户主动开启“配音”后，可在“选角”中为旁白和每名角色分别选择宿主声线；映射按游戏 ID 保存，不同本地游戏和示例项目互不串用。配音期间会暂时压低 BGM，自动播放会等待语音结束，手动推进、暂停、返回剧目库或销毁 Page 都会停止当前语音。

语音是可选能力，不参与启动器首屏加载。未登录、未授权、供应商未配置或服务超时时，本地游戏加载、字幕阅读、存档与编辑器仍可使用。具体声线与供应商由 Myriad 管理，Tapp 不读取腾讯云等服务密钥。

## 本地游戏目录

```text
my-story/
├─ game.json
├─ scenario/
│  └─ main.echo
└─ assets/
   ├─ platform.webp
   └─ farewell.ogg
```

最小 `game.json`：

```json
{
  "format": "echo-stage/v1",
  "id": "com.example.my-story",
  "title": "我的故事",
  "entry": "scenario/main.echo",
  "assets": {
    "platform": "assets/platform.webp",
    "farewell": "assets/farewell.ogg"
  }
}
```

多语言游戏可把 `entry` 换成 `entries`：

```json
{
  "entries": {
    "zh-CN": "scenario/main.zh-CN.echo",
    "en-US": "scenario/main.en-US.echo",
    "ja-JP": "scenario/main.ja-JP.echo"
  }
}
```

## `.echo` 剧本

```text
@background platform
@speaker 遥
@say 一首歌停止以后，沉默并不会证明它从未响起。
@choice 记住 => remember | 放下 => release

@label remember
@set answer = memory
@jump ending

@label release
@set answer = release

@label ending
@if answer == memory -> memory_end
@end 潮汐 | 故事在这里结束。

@label memory_end
@end 余响 | 被记住的事物也仍然可以改变。
```

第一版命令：

- `@background assetId`：切换背景；
- `@speaker name`、`@say text`、`@narrate text`：对白与旁白；
- `@choice text => label | text => label`：2–8 个选项；
- `@label name`、`@jump name`：标签与跳转；
- `@set name = value`：写入字符串、数字、布尔值或 `null`；
- `@if name == value -> label`（也支持 `!=`）：条件跳转；
- `@music assetId`、`@music stop`：循环 BGM 与停止；
- `@end title | text`：显示结局。

`assetId` 必须预先声明在 `game.json.assets`。支持常见图片、音频与 Web 媒体扩展名；剧本上限 1 MiB，`game.json` 上限 256 KiB，单次目录选择最多 512 个文件。

## 第一版边界

- 浏览器安全模型要求玩家在每次新的 Page 会话中重新选择本地目录；存档会保留，但不会持久保存目录权限。
- 播放器暂不直接加载 ZIP、TAR、XP3、KAG/TJS、角色立绘图层、游戏包预生成语音文件映射、转场脚本和插件系统；下载的开发示例需要先解开，再选择目录。宿主自动配音是逐句生成能力，不等同于游戏包语音资源系统。
- 当前 `Tapp.file.download()` 只接受字符串，无法无损输出二进制 ZIP；因此开发示例采用只含 UTF-8 文本的 TAR 归档。可使用 `tar -xf EchoStageDemo.tar` 解开。
- 本地目录被视为只读虚拟文件系统；禁止绝对路径、空路径段和 `..`。
- 游戏内容指纹变化后，旧存档不会强行载入。
- 内置示例背景、场景 CG 与剧目库舞台背景由 OpenAI 内置图像生成工具创作。
- AI 创作需要安装时授予提升权限 `ai:generate` 与 `ai:image`；没有权限时，本地编辑、剧本检查、试玩已有内容和导出仍保持可用。
- 自动配音需要登录并授予提升权限 `speech:tts`；语音状态与声线列表只在进入播放器且已启用配音，或用户主动打开配音/选角时查询，不阻塞启动器首页。
- 应用申请基础权限 `ui:notification`；AI 权限缺失、请求失败、任务超时和结果契约错误会同时显示 Myriad 宿主错误通知与编辑器内详细状态。
- AI 场景 URL 的保留期由宿主/供应商决定，不能当作永久本地素材；项目导出会保留提示词和期望文件名，便于重新生成或落盘。

## 开发验证

在仓库根目录执行：

```powershell
node --test apps/cn.echootaku.echo-stage/tests/*.test.cjs
node scripts/validate-app.mjs --app cn.echootaku.echo-stage
```

自动校验和打包不能代替在真实 Myriad 中选择本地目录、分支阅读、存取档、宿主扩大/恢复与生命周期回归。扩大能力由 Myriad 自己的窗口控件提供，Tapp 不重复绘制同义按钮。
