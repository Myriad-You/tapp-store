# Tapp 开发文档

> 📚 本文档已拆分为模块化结构，请根据需要查阅对应文档。

## 📖 模块文档

| 文档                                  | 说明                                      |
| ------------------------------------- | ----------------------------------------- |
| [快速入门](tapp/QUICKSTART.md)        | 5 分钟创建第一个 Tapp，代码架构，生命周期 |
| [Manifest 配置](tapp/MANIFEST.md)     | 完整的 manifest.json 配置参考             |
| [SDK API 参考](tapp/API_REFERENCE.md) | 所有 Tapp SDK API 详细文档                |
| [小组件开发](tapp/WIDGET.md)          | Widget 开发指南、尺寸适配、样式规范       |
| [安全沙箱](tapp/SANDBOX.md)           | CSP 策略、iframe 限制、权限系统           |
| [样式规范](tapp/STYLING.md)           | CSS 变量、Tailwind 集成、Glass 风格       |
| [REST API](tapp/REST_API.md)          | 后端 REST API 端点参考                    |

## 🚀 快速导航

### 新手入门

1. 阅读 [快速入门](tapp/QUICKSTART.md) 创建第一个 Tapp
2. 了解 [Manifest 配置](tapp/MANIFEST.md) 完善应用信息
3. 查阅 [SDK API 参考](tapp/API_REFERENCE.md) 使用各种功能

### 开发小组件

1. 查看 [小组件开发](tapp/WIDGET.md) 了解 Widget SDK 限制
2. 参考 [样式规范](tapp/STYLING.md) 实现 Glass 风格设计
3. 了解 [安全沙箱](tapp/SANDBOX.md) 避免 XSS 风险

### 高级功能

1. [Manifest 配置 - API 声明](tapp/MANIFEST.md#api-声明) - API 声明与 Spoof 模式
2. [SDK API 参考 - 定时任务](tapp/API_REFERENCE.md#定时任务-api) - 定时任务调度
3. [REST API](tapp/REST_API.md) - 直接调用后端接口

## 📁 目录结构

```
docs/development/tapp/
├── QUICKSTART.md      # 快速入门
├── MANIFEST.md        # Manifest 配置
├── API_REFERENCE.md   # SDK API 参考
├── WIDGET.md          # 小组件开发
├── SANDBOX.md         # 安全沙箱
├── STYLING.md         # 样式规范
└── REST_API.md        # REST API 端点
```

---

## 📝 更新日志

### 2025-12-08 - 文档重构

- 📚 将单一 4500 行文档拆分为 7 个模块化文档
- 🆕 新增导航索引，便于快速定位
- 🆕 `api_declarations` 配置：声明外部 API 端点
- 🆕 Spoof 模式：隐藏真实 API 端点，显示伪装地址
- 🆕 后端 `spoof_utils.rs` 服务支持

### 2025-12-06 - 样式规范文档修正

- 📝 Widget 模式完全支持 Tailwind CSS
- 📝 Page 模式使用内联 style + tapp-\* 工具类
- 🔧 修正 `Tapp.ui.confirm()` 等 API 签名

### 2025-12-05 - 主色调 API & 后台运行需求

- 🆕 `Tapp.ui.getPrimaryColor()` 获取壁纸主色调
- 🆕 `Tapp.background` API 声明后台运行需求
- 🆕 7 种后台需求类型

### 2025-11-20 - 自适应尺寸 + i18n

- 🆕 自动注入自适应 CSS 变量
- 🆕 响应式工具类
- 🆕 `Tapp.ui.getLocale()` 获取用户语言

### 2025-10-15 - 代码分离架构

- 🆕 分离模式：core, widget, page 代码分离
- 🆕 Widget 预注册机制

### 2025-09-01 - 安全增强版本

- 🆕 `Tapp.dom` 安全 API
- 🆕 增强 AI 提示词安全检测

### 2025-08-01 - 初始版本

- 基础 API (storage, ui, lifecycle)
- 小组件系统
- 平台数据访问
- AI 集成
