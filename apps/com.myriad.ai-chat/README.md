# AI 聊天助手

🤖 AI 驱动的智能对话助手，支持多轮对话

## 功能特点

- **智能对话**: 由 AI 驱动的自然语言对话
- **多轮会话**: 支持上下文理解的连续对话
- **对话历史**: 自动保存对话记录
- **页面模式**: 完整的聊天界面
- **小组件模式**: 桌面快捷 AI 对话入口
- **主题适配**: 自动适配深色/浅色主题
- **主色调同步**: 实时跟随系统壁纸色，UI 颜色自动调整
- **安全防护**: 使用 DOM 安全 API 防止 XSS 攻击

## 安装

从 Myriad 应用商店安装，或手动导入应用包。

## 使用说明

### 页面模式

在导航菜单中点击「AI 聊天助手」进入完整对话界面：

- 支持长文本输入（textarea）
- 显示完整对话历史和时间戳
- 提供快捷问题建议
- Shift+Enter 换行，Enter 发送

### 小组件模式

添加 AI 助手小组件到桌面：

- 支持 2x2、4x2、4x4 三种尺寸
- 快速发送问题
- 查看最近对话
- 紧凑模式自动适配

## 权限说明

| 权限              | 用途              |
| ----------------- | ----------------- |
| `storage`         | 保存对话历史      |
| `ui:notification` | 显示系统通知      |
| `ui:theme`        | 适配深色/浅色主题 |
| `component:page`  | 注册独立页面      |
| `ai:generate`     | 调用 AI 生成能力  |

## 设置选项

- **保存对话历史**: 控制是否在退出后保留对话记录（默认：开启）
- **最大历史条数**: 设置保留的最大对话条数（默认：100，范围：10-500）
- **AI 回复长度**: AI 回复的最大 token 数（默认：500，范围：100-2000）

## 技术架构

采用最新的 Tapp 开发标准，代码分离架构：

### Core 代码
- `getThemeColors(isDark, primaryColor)`: 主题颜色配置，支持自定义主色调
- `adjustColorBrightness()`: 颜色亮度调整工具
- `formatTime()`: 时间格式化工具
- `getLoadingIcon()`: 加载动画 SVG
- `getSendIcon()`: 发送图标 SVG

### Widget 代码
- 小组件渲染逻辑
- 独立的消息历史管理（widgetMessages）
- 响应式尺寸适配
- 主色调集成（`Tapp.ui.getPrimaryColor()`）

### Page 代码
- 完整页面渲染
- 生命周期管理
- 组件注册和注销
- 主题变化监听（`Tapp.ui.onThemeChange()`）
- 主色调变化监听（`Tapp.ui.onPrimaryColorChange()`）

### 新特性
- **Widget 自动注册**: 通过 Manifest 的 `widgets` 字段自动预注册
- **新 AI API**: 使用 `Tapp.ai.generate({ prompt, maxTokens })` 返回结构化响应
- **DOM 安全 API**: 使用 `Tapp.dom.setText()` 和 `Tapp.dom.createElement()` 防止 XSS
- **设置集成**: 通过 `Tapp.settings.get()` 读取用户配置
- **主色调 API**: 使用 `Tapp.ui.getPrimaryColor()` 获取壁纸色并实时监听变化

## 版本历史

### v1.0.0（最新）

- ✨ 重构为新 Tapp 标准
- 🏗️ 采用 Core + Widget + Page 分离架构
- 🔒 使用 DOM 安全 API 防止 XSS
- 🎨 优化主题适配和颜色系统
- 🌈 集成主色调 API，UI 颜色跟随系统壁纸实时调整
- ⚡ 新 AI API 集成
- 🔧 移除手动 Widget 注册（使用 Manifest 自动注册）
- 📱 改进响应式尺寸适配
- 🎯 添加更多用户可配置选项
- 🎭 监听主题和主色调变化，动态更新界面

### v0.1.0

- 初始版本（旧标准）

## 作者

Myriad Team
