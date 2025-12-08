# AI 聊天助手 v3.0

🤖 AI 驱动的智能对话助手，完全重构版本

## ✨ 功能特点

- **智能对话**: 由 AI 驱动的自然语言对话
- **多轮会话**: 支持上下文理解的连续对话
- **对话历史**: 自动保存对话记录（可配置）
- **页面模式**: 完整的聊天界面，使用最新 Glass 风格设计
- **小组件模式**: 桌面快捷 AI 对话入口，支持 4x2 和 4x4 尺寸
- **主题适配**: 完美支持深色/浅色主题，使用 neutral 颜色系统
- **主色调同步**: 实时跟随系统壁纸色，UI 颜色自动调整
- **安全防护**: 使用 DOM 安全 API 防止 XSS 攻击
- **响应式设计**: 支持 scale 和 fontScale props
- **国际化**: 支持中英文界面

## 安装

从 Myriad 应用商店安装，或手动导入应用包。

## 使用说明

### 页面模式

在导航菜单中点击「AI 聊天助手」进入完整对话界面：

- 支持长文本输入（textarea）
- 显示完整对话历史
- 提供快捷问题建议
- Shift+Enter 换行，Enter 发送

### 小组件模式

添加 AI 助手小组件到桌面：

- 支持 4x2、4x4 两种尺寸
- 4x2：紧凑模式，显示最近消息
- 4x4：完整对话模式，支持消息历史
- 快速发送问题并获取 AI 回复

## 权限说明

| 权限              | 用途              |
| ----------------- | ----------------- |
| `storage`         | 保存对话历史      |
| `ui:notification` | 显示系统通知      |
| `ui:theme`        | 适配深色/浅色主题 |
| `ai:chat`         | 调用 AI 对话能力  |

## 设置选项

- **保存对话历史**: 控制是否在退出后保留对话记录（默认：开启）
- **最大历史条数**: 设置保留的最大对话条数（默认：50，范围：10-200）
- **系统提示词**: 自定义 AI 的行为风格

## 技术架构

采用最新的 Tapp 开发标准，使用**混合渲染模式**：

### 文件结构

```
com.myriad.ai-chat/
├── manifest.json       # 应用清单
├── main.js             # 主代码（共用 + Widget + Page 逻辑）
├── styles.css          # 自定义样式（补充 Tailwind）
├── page.html           # 页面模式 HTML 模板
├── widget-4x2.html     # 4x2 小组件 HTML 模板
├── widget-4x4.html     # 4x4 小组件 HTML 模板
└── README.md           # 说明文档
```

### 混合渲染模式

与纯 JS 渲染不同，本 Tapp 使用混合渲染模式：

1. **HTML 模板**: 定义静态结构（page.html, widget-*.html）
2. **JS 代码**: 绑定事件、处理逻辑、动态更新

这种模式的优势：
- ✅ 更好的代码可读性
- ✅ HTML 和 JS 职责分离
- ✅ 更容易调试和维护
- ✅ 更快的首屏渲染

### 样式特性

- **毛玻璃背景**: `glass` 类 + `backdrop-blur`
- **渐变光晕**: 动态主题色光晕装饰
- **颜色系统**: Indigo 主色调 + Neutral 文本系统
- **暗色适配**: 完整的 `dark:` 前缀支持
- **Tailwind CSS**: 完全基于 Tailwind 构建

### API 使用

- **AI Chat API**: `Tapp.ai.chat(messages, context, options)`
  - 返回: `{ message: { role, content }, usage: { ... }, sessionId }`
- **设置集成**: `Tapp.settings.getAll()` 读取配置
- **存储 API**: `Tapp.storage.get/set()` 保存历史
- **主色调 API**: `Tapp.ui.getPrimaryColor()` 获取壁纸色

### 生命周期

- **Widget 模式**: 通过 `window._TAPP_MODE === 'widget'` 检测
- **Page 模式**: 使用 `Tapp.lifecycle.onReady()` 初始化
- **销毁**: `Tapp.lifecycle.onDestroy()` 保存历史

## 📝 版本历史

### v3.0.0（2025-12-08）

🎉 **完全重构版本 - 符合最新 Tapp 开发标准**

#### 架构改进
- ✅ **混合渲染模式**: HTML 模板 + JS 事件绑定
- ✅ **文件结构规范化**: 添加缺失的模板文件
- ✅ **代码组织优化**: 清晰的模式检测和初始化逻辑

#### UI/UX 改进
- 🎨 **Glass 风格设计**: 使用标准 `glass` 类和毛玻璃效果
- 🌟 **光晕背景效果**: 动态主题色光晕装饰
- 🎨 **Neutral 颜色系统**: 深色模式使用纯中性灰
- 📐 **响应式设计**: 完整支持 scale 和 fontScale props

#### 功能优化
- ⚡ **性能优化**: HTML 预渲染 + JS 事件绑定
- 🔒 **安全增强**: 使用 escapeHtml 防止 XSS 攻击
- 🌐 **国际化**: 完整的中英文支持
- 🎭 **主题响应**: 实时响应主题和主色调变化

### v1.0.0

- 初始版本（旧标准，已废弃）

## 作者

Myriad Team
