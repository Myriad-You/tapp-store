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

采用最新的 Tapp 开发标准，完全符合新样式规范：

### Core 代码
- `formatTime()`: 时间格式化工具
- `getPrimaryColor()`: 获取全局主色调，带错误处理

### Widget 代码
- ✅ **Tailwind CSS 样式**: 完全使用 Tailwind 类名
- ✅ **毛玻璃风格**: `glass` 类 + `backdrop-blur`
- ✅ **渐变装饰层**: `from-violet-500/5 to-transparent`
- ✅ **响应式 props**: 支持 `scale`, `fontScale`, `isEditMode`
- ✅ **HTML 模板**: 使用 `innerHTML` + 模板字符串
- ✅ **独立消息存储**: `widgetMessages`
- ✅ **编辑模式边框**: 虚线边框指示器

### Page 代码
- ✅ **双层架构**: `#tapp-background` 装饰层 + `#tapp-content` 内容层
- ✅ **渐变光晕**: 背景层使用 `primaryColor` 生成动态光晕
- ✅ **Safe Area**: 内容层自动 72px 顶部 padding（全屏模式）
- ✅ **现代化 UI**: Tailwind + 毛玻璃效果
- ✅ **响应式布局**: 最大宽度 5xl，居中布局
- ✅ **自适应 textarea**: 自动调整高度
- ✅ **生命周期管理**: `onReady`, `onDestroy`
- ✅ **主题监听**: 主题和主色调变化自动重渲染

### 样式特性
- **毛玻璃背景**: `bg-white/60 dark:bg-white/[0.03] backdrop-blur`
- **渐变装饰**: `bg-gradient-to-br from-violet-500/5`
- **颜色系统**: Indigo 主色调 + Gray 文本系统
- **暗色适配**: 完整的 `dark:` 前缀支持
- **过渡动画**: `transition-colors`, `transition-all`
- **自定义滚动条**: `scrollbar-thin scrollbar-thumb-gray-300`

### API 使用
- **Widget 自动注册**: 通过 Manifest 的 `widgets` 字段
- **新 AI API**: `Tapp.ai.generate({ prompt, maxTokens })`
- **DOM 安全 API**: `Tapp.dom.escapeHtml()` 防止 XSS
- **设置集成**: `Tapp.settings.get()` 读取配置
- **主色调 API**: `Tapp.ui.getPrimaryColor()` 获取壁纸色

## 版本历史

### v1.0.0（最新）

- ✨ **完全重构为新 Tapp 标准**
- 🏗️ **代码分离架构**: Core + Widget + Page 三部分分离
- 🎨 **毛玻璃风格**: 完整使用 Tailwind CSS + Glass 设计
- 🌈 **主色调集成**: UI 颜色跟随系统壁纸实时调整
- 📐 **响应式设计**: 支持 scale/fontScale props
- 🎯 **编辑模式**: 虚线边框指示器
- 🔒 **安全防护**: DOM 安全 API 防止 XSS
- ⚡ **新 AI API**: 结构化响应格式
- 🔧 **Widget 自动注册**: Manifest 自动预注册
- 🎭 **实时响应**: 主题和主色调变化自动重渲染
- 🌓 **完整暗色模式**: dark: 前缀全覆盖
- 📱 **渐变装饰层**: 视觉层次丰富
- ⚙️ **用户设置**: 可配置历史条数和 Token 长度

### v0.1.0

- 初始版本（旧标准）

## 作者

Myriad Team
