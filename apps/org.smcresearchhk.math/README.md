# 函数图形计算器 (Function Graph Calculator)

类似 GeoGebra 的交互式函数绘图 Tapp，面向 Myriad 平台。

**包 ID：** `org.smcresearchhk.math`  
**作者：** [WKSYweb](https://github.com/WKSYweb)

## 功能

- **多函数叠加**：同时绘制多条曲线，可单独显示/隐藏、换色、删除
- **安全表达式解析**：自实现递归下降解析器，支持 `sin/cos/tan`、`exp/ln/sqrt/abs`、幂运算、隐式乘法等，**不使用 `eval`**
- **坐标系交互**：滚轮以指针为中心缩放、拖拽平移、网格与坐标轴开关、重置视图
- **轨迹提示**：鼠标悬停显示坐标与函数值
- **求值面板**：对表达式求数值结果
- **常用预设**：一键添加 `sin(x)`、`x^2`、`exp(-x^2)`、`sin(x)/x` 等
- **状态持久化**：函数列表与视图范围写入 `Tapp.storage`
- **明暗主题**：跟随宿主深色模式
- **中 / 英 / 日** 界面文案

## 文件结构

```
org.smcresearchhk.math/
├── manifest.json
├── main.js
├── page.html
├── page.css
└── README.md
```

## 权限

| 权限 | 用途 |
|------|------|
| `storage` | 保存函数列表与视图 |
| `ui:theme` | 适配明暗主题 |

无需网络权限。

## 本地校验与打包

```bash
npx --yes --package=@myriad-you/tapp-cli@0.1.0 myriad-tapp check ./org.smcresearchhk.math --json
npx --yes --package=@myriad-you/tapp-cli@0.1.0 myriad-tapp pack ./org.smcresearchhk.math --json
```

## 表达式说明

- 运算：`+ - * / ^`（或 `**`）、括号
- 常量：`pi`、`e`、`tau`
- 函数：`sin cos tan asin acos atan sinh cosh tanh sqrt abs ln log log10 exp floor ceil round sign`
- 隐式乘法：`2x`、`3(x+1)`
- 角度单位为**弧度**

## 许可证

MIT
