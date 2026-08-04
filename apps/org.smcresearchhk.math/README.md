# 函数图形计算器 (Function Graph Calculator)

类似 GeoGebra 的交互式函数绘图 Tapp，面向 Myriad 平台。

## 功能

- **多函数叠加**：同时绘制多条曲线，可单独显示/隐藏、换色、删除
- **安全表达式解析**：自实现递归下降解析器，支持 `sin/cos/tan`、`exp/ln/sqrt/abs`、幂运算、隐式乘法等，**不使用 `eval`**
- **坐标系交互**：滚轮以指针为中心缩放、拖拽平移、网格与坐标轴开关、重置视图
- **轨迹提示**：鼠标悬停显示 \(x\) 与各函数近似值
- **求值面板**：对不含 \(x\) 的表达式求数值结果
- **常用预设**：一键添加 `sin(x)`、`x^2`、`exp(-x^2)`、`sin(x)/x` 等
- **状态持久化**：函数列表与视图范围写入 `Tapp.storage`
- **明暗主题**：跟随宿主深色模式（中性黑配色，符合 PAGE 规范）
- **中 / 英 / 日** 界面文案

## 文件结构

```
com.example.function-graph/
├── manifest.json   # 元数据、权限、设置项
├── main.js         # 解析器 + 绘图 + UI 逻辑
├── page.html       # 页面模板
├── page.css        # 页面样式
└── README.md
```

## 权限

| 权限 | 用途 |
|------|------|
| `storage` | 保存函数列表与视图 |
| `ui:theme` | 适配明暗主题 |
| `ui:notification` | 预留通知（可选） |

无需网络权限。

## 本地校验与打包

在已安装 `@myriad/tapp-cli` 的环境中：

```bash
npx --yes --package=@myriad/tapp-cli@0.1.0 myriad-tapp check ./com.example.function-graph --json
npx --yes --package=@myriad/tapp-cli@0.1.0 myriad-tapp pack ./com.example.function-graph --json
```

产物：`dist/com.example.function-graph.tapp`，可在 Myriad 中通过「安装文件」导入。

## 发布到 tapp-store

1. 将本目录放入 `apps/com.example.function-graph/`
2. 在根目录 `index.json` 的 `apps` 中增加条目（`id` / `version` / `category` 与 Manifest 一致，`download` 指向 `manifest` 与 `code` 等）
3. 提交 PR 至 [Myriad-You/tapp-store](https://github.com/Myriad-You/tapp-store)

## 表达式说明

支持：

- 运算：`+ - * / ^`（或 `**`）、括号
- 常量：`pi`、`e`、`τ` 写作 `tau`
- 函数：`sin cos tan asin acos atan sinh cosh tanh sqrt abs ln log log10 exp floor ceil round sign`
- 隐式乘法：`2x`、`3(x+1)`、`)(` → `)*(`

角度单位为**弧度**。

## 限制与后续可扩展点

- 当前为显式 \(y = f(x)\) 曲线采样，不支持隐式方程、参数方程、不等式区域填色
- 未做符号求导 / 积分；可在后续版本增加数值微分切线
- 大范围幂函数可能因浮点溢出出现断点，采样处已做简单间断判断

## 许可证

MIT（与官方商店示例一致，可按需修改）
