# 朝夕

记录值得期待与纪念的日子，并通过多尺寸 Widget 随时查看最近倒数。

## 功能

- 创建、编辑与删除日期事件
- 支持生活、生日、纪念、学习、旅行和其他预设分类，也可添加自定义分类
- 支持每年重复与自定义标记颜色
- 支持置顶重要日子，并优先展示在 Page 与 Widget
- 提供今天、7 天后、30 天后和一年后的快捷日期
- 临近七天和当天的日子显示状态标识
- 按全部、即将到来、已置顶、已过单次筛选；每年重复事件始终展示下一次日期
- 按名称和备注搜索
- `2x2`、`4x2`、`4x4` 三种 Widget
- Page 与 Widget 通过 `Tapp.storage` 自动同步
- 亮色、暗色主题、Myriad 原生 `.glass` 材质和响应式页面

## 包结构

```text
cn.echootaku.days/
├── manifest.json
├── main.js
├── page.html
├── page.css
├── widget.css
├── templates/
│   ├── widget-2x2.html
│   ├── widget-4x2.html
│   └── widget-4x4.html
├── preview.html
└── preview.css
```

## 数据与权限

所有日期保存在当前用户的 `days.events.v1` storage key，自定义分类保存在 `days.categories.v1`；数据不会上传到外部服务。

| 权限 | 用途 |
| --- | --- |
| `storage` | 保存日期事件 |
| `ui:notification` | 显示保存和删除结果 |
| `ui:theme` | 跟随系统主题 |
| `ui:confirm` | 删除前确认 |
| `widget:register` | 声明主页 Widget |

## 本地校验与打包

在仓库根目录运行：

```powershell
node .\tapp-cli\bin\myriad-tapp.mjs check .\apps\cn.echootaku.days --json
node .\tapp-cli\bin\myriad-tapp.mjs pack .\apps\cn.echootaku.days --out .\apps\cn.echootaku.days\dist\cn.echootaku.days.tapp --json
```

生成的 `dist/` 仅用于本地安装验证，不提交到商店仓库。

## 后续方向

- 定时提醒与 scheduler
- JSON 导入导出
- 农历和节假日
- Widget 独立显示设置
