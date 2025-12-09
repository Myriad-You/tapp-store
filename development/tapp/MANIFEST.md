# Manifest 配置

Manifest 是 Tapp 的核心配置文件，定义了应用的元数据、权限和功能。

## 基础字段

| 字段                    | 类型     | 必填 | 说明                               |
| ----------------------- | -------- | ---- | ---------------------------------- |
| `id`                    | string   | ✅   | 唯一标识符，推荐使用反向域名格式   |
| `name`                  | string   | ✅   | 应用名称                           |
| `version`               | string   | ✅   | 版本号（语义化版本）               |
| `description`           | string   | ❌   | 应用描述                           |
| `main`                  | string   | ✅   | 入口文件名                         |
| `author`                | object   | ❌   | 作者信息 `{name, email?, url?}`    |
| `permissions`           | string[] | ❌   | 所需权限列表                       |
| `optionalPermissions`   | string[] | ❌   | 可选权限（运行时请求）             |
| `icon`                  | string   | ❌   | 图标（emoji 或 URL）               |
| `themeColor`            | string   | ❌   | 主题色（十六进制）                 |
| `widgets`               | object[] | ❌   | 小组件定义                         |
| `hasPage`               | boolean  | ❌   | 是否有页面模块（可在页面模式运行） |
| `settings`              | object[] | ❌   | 用户可配置的设置项                 |
| `api_declarations`      | object[] | ❌   | 外部 API 声明（代理+权限校验）     |
| `contentSecurityPolicy` | object   | ❌   | 覆盖默认 CSP 指令                  |
| `minSystemVersion`      | string   | ❌   | 最低系统版本要求                   |
| `homepage`              | string   | ❌   | 应用主页 URL                       |
| `repository`            | string   | ❌   | 代码仓库 URL                       |
| `cssMode`               | string   | ❌   | CSS 架构模式：`unified`（默认）或 `separated` |
| `styles`                | string   | ❌   | 统一 CSS 文件路径（unified 模式）  |
| `widgetStyles`          | string   | ❌   | Widget 专用 CSS 文件路径（separated 模式） |
| `pageStyles`            | string   | ❌   | Page 专用 CSS 文件路径（separated 模式） |
| `pageTemplate`          | string   | ❌   | 页面 HTML 模板路径                 |

## 完整示例

```json
{
  "id": "com.example.my-tapp",
  "name": "我的应用",
  "version": "1.0.0",
  "description": "一个功能丰富的 Tapp 示例",
  "main": "index.js",
  "author": {
    "name": "开发者名称",
    "email": "dev@example.com",
    "url": "https://example.com"
  },
  "icon": "🚀",
  "themeColor": "#6366f1",
  "permissions": ["storage", "ui:notification", "platform:read"],
  "optionalPermissions": ["network:fetch"],
  "hasPage": true,
  "homepage": "https://example.com",
  "repository": "https://github.com/example/my-tapp",
  "minSystemVersion": "1.0.0",
  "api_declarations": [
    {
      "endpoint": "https://api.weather.com/v1/current",
      "methods": ["GET"],
      "description": "获取天气信息",
      "spoof": {
        "enabled": true,
        "region": "china"
      }
    }
  ],
  "widgets": [
    {
      "id": "stats-widget",
      "name": "数据统计",
      "description": "展示平台统计数据",
      "icon": "📊",
      "defaultSize": "2x2",
      "sizes": ["1x1", "1x2", "2x1", "2x2", "4x2", "4x4"],
      "refreshInterval": 60000,
      "category": "tool"
    }
  ],
  "settings": [
    {
      "key": "refreshInterval",
      "type": "number",
      "label": "刷新间隔",
      "description": "自动刷新间隔（秒）",
      "defaultValue": 60,
      "min": 10,
      "max": 3600
    }
  ]
}
```

---

## widgets 配置

小组件定义允许用户将应用添加到 Dashboard。

```json
{
  "widgets": [
    {
      "id": "my-widget",
      "name": "我的小组件",
      "description": "示例 Widget",
      "icon": "🧊",
      "defaultSize": "2x2",
      "sizes": ["1x1", "1x2", "2x1", "2x2", "3x2", "4x2", "4x4"],
      "refreshInterval": 60000,
      "category": "tool",
      "templates": {
        "2x2": "templates/widget-2x2.html",
        "4x2": "templates/widget-4x2.html"
      },
      "configSchema": {
        "type": "object",
        "properties": {
          "title": { "type": "string", "title": "标题" },
          "showChart": { "type": "boolean", "title": "显示图表" }
        }
      }
    }
  ]
}
```

### Widget 字段说明

| 字段              | 类型     | 必填 | 说明                             |
| ----------------- | -------- | ---- | -------------------------------- |
| `id`              | string   | ✅   | Widget 唯一标识符                |
| `name`            | string   | ✅   | Widget 显示名称                  |
| `description`     | string   | ❌   | Widget 描述                      |
| `icon`            | string   | ❌   | Widget 图标（emoji 或 URL）      |
| `defaultSize`     | string   | ✅   | 默认尺寸（如 "2x2"）             |
| `sizes`           | string[] | ❌   | 支持的尺寸列表                   |
| `refreshInterval` | number   | ❌   | 刷新间隔（毫秒）                 |
| `category`        | string   | ❌   | 分类（tool, data, media, custom) |
| `templates`       | object   | ❌   | HTML 模板（按尺寸覆盖）          |
| `configSchema`    | object   | ❌   | 配置 Schema（声明式配置 UI）     |

### 支持的尺寸

| 尺寸  | 像素（默认） | 适用场景         |
| ----- | ------------ | ---------------- |
| `1x1` | 100×100      | 图标、状态指示器 |
| `1x2` | 100×200      | 竖向简报         |
| `2x1` | 200×100      | 简单统计、标题   |
| `2x2` | 200×200      | 标准小组件       |
| `2x3` | 200×300      | 列表 / 纵向卡片  |
| `3x2` | 300×200      | 横向信息块       |
| `4x2` | 400×200      | 宽幅展示、图表   |
| `2x4` | 200×400      | 长列表 / Feed    |
| `3x3` | 300×300      | 中等复杂组件     |
| `4x4` | 400×400      | 大型展示         |

---

## cssMode 配置

CSS 架构模式控制样式文件的加载策略。

### 统一模式（默认）

使用单一 CSS 文件，Widget 和 Page 共享样式：

```json
{
  "cssMode": "unified",
  "styles": "styles.css"
}
```

**文件结构：**
```
my-tapp/
├── manifest.json
├── main.js
├── styles.css        # 所有样式
├── page.html
├── widget-4x2.html
└── widget-4x4.html
```

**优点：** 简单，适合小型 Tapp
**缺点：** Widget 和 Page 加载无关样式，增加资源大小

### 分离模式

Widget 和 Page 使用独立的 CSS 文件：

```json
{
  "cssMode": "separated",
  "widgetStyles": "widget.css",
  "pageStyles": "page.css"
}
```

**文件结构：**
```
my-tapp/
├── manifest.json
├── main.js
├── widget.css        # Widget 专用样式
├── page.css          # Page 专用样式
├── page.html
├── widget-4x2.html
└── widget-4x4.html
```

**优点：**
- 按需加载：Widget 只加载 widget.css，Page 只加载 page.css
- 更小的资源体积
- 更好的缓存效率
- 避免样式冲突

**缺点：** 需要维护多个 CSS 文件

### 混合模式

可以同时使用 `styles` 作为共享样式：

```json
{
  "cssMode": "separated",
  "styles": "shared.css",
  "widgetStyles": "widget.css",
  "pageStyles": "page.css"
}
```

**加载策略：**
- Widget 模式：加载 `shared.css` + `widget.css`
- Page 模式：加载 `shared.css` + `page.css`

### 最佳实践

1. **小型 Tapp（< 200 行 CSS）：** 使用统一模式
2. **中大型 Tapp：** 使用分离模式
3. **共享变量和基础样式：** 放在 `styles`（共享）
4. **组件特定样式：** 放在对应的分离文件

---

## hasPage 配置

声明应用是否有页面模块。设为 `true` 后，运行中的 Tapp 可以点击打开页面视图。

```json
{
  "hasPage": true
}
```

### 页面模块的作用

页面模块允许 Tapp 提供完整的页面体验，而不仅仅是小组件。当用户点击运行中的 Tapp 时，会打开一个全屏页面视图。

### 何时声明 `hasPage: true`

- 应用需要提供详细的配置界面
- 应用需要展示大量数据（如列表、报告、仪表盘）
- 应用需要复杂的交互界面（如编辑器、游戏）
- 应用希望提供比 Widget 更丰富的功能

### 代码结构要求

声明 `hasPage: true` 后，需要在 `PAGE_CODE` 中定义页面渲染逻辑：

```javascript
// PAGE_CODE 中
Tapp.pages["my-page"] = {
  render: function (container, locale, isDark, primaryColor) {
    var bgLayer = document.getElementById("tapp-background");
    var contentLayer = document.getElementById("tapp-content");
    // 渲染页面...
  },
};

Tapp.lifecycle.onReady(async function () {
  var locale = await Tapp.ui.getLocale();
  var theme = await Tapp.ui.getTheme();
  var primaryColor = await Tapp.ui.getPrimaryColor();

  Tapp.pages["my-page"].render(null, locale, theme === "dark", primaryColor);
});
```

---

## settings 配置

允许用户自定义 Tapp 行为。

```json
{
  "settings": [
    {
      "key": "refreshInterval",
      "type": "number",
      "label": "刷新间隔",
      "description": "自动刷新间隔（秒）",
      "defaultValue": 60,
      "min": 10,
      "max": 3600
    },
    {
      "key": "theme",
      "type": "select",
      "label": "主题",
      "defaultValue": "auto",
      "options": [
        { "value": "auto", "label": "跟随系统" },
        { "value": "light", "label": "亮色" },
        { "value": "dark", "label": "暗色" }
      ]
    },
    {
      "key": "showDetails",
      "type": "toggle",
      "label": "显示详情",
      "defaultValue": true
    }
  ]
}
```

### 支持的设置类型

| 类型     | 说明     | 额外字段                                 |
| -------- | -------- | ---------------------------------------- |
| `toggle` | 开关     | -                                        |
| `select` | 下拉选择 | `options: [{value, label}]`              |
| `input`  | 文本输入 | `placeholder`, `maxLength`               |
| `number` | 数字输入 | `min`, `max`, `step`                     |
| `color`  | 颜色选择 | `presets: string[]` (可选的预设颜色列表) |

### 读取设置

```javascript
// 使用 Tapp.settings API
const refreshInterval = await Tapp.settings.get("refreshInterval");
const allSettings = await Tapp.settings.getAll();

// 或使用 Tapp.storage（设置以 _settings. 前缀存储）
const value = await Tapp.storage.get("_settings.refreshInterval");
```

---

## API 声明 (api_declarations)

声明 Tapp 需要调用的外部 API。所有网络请求必须通过声明式 API 进行，系统会校验并代理请求。

```json
{
  "api_declarations": [
    {
      "endpoint": "https://api.example.com/data",
      "methods": ["GET", "POST"],
      "description": "获取数据",
      "spoof": {
        "enabled": true,
        "region": "china",
        "display_endpoint": "https://public.example.com/api"
      }
    }
  ]
}
```

### API 声明字段

| 字段                     | 类型     | 必填 | 说明                                     |
| ------------------------ | -------- | ---- | ---------------------------------------- |
| `endpoint`               | string   | ✅   | 真实请求 URL                             |
| `methods`                | string[] | ❌   | 允许的 HTTP 方法，默认 ["GET"]           |
| `description`            | string   | ❌   | API 描述（用户可见）                     |
| `spoof`                  | object   | ❌   | 伪装配置                                 |
| `spoof.enabled`          | boolean  | ❌   | 是否启用伪装                             |
| `spoof.region`           | string   | ❌   | 区域伪装：china/japan/us/korea/taiwan/hk |
| `spoof.display_endpoint` | string   | ❌   | 用户可见的伪装端点                       |

### 区域伪装 (spoof.region)

用于绕过地区限制，自动添加对应地区的请求头：

| 代码                     | 地区     |
| ------------------------ | -------- |
| `china` / `cn`           | 中国大陆 |
| `japan` / `jp`           | 日本     |
| `us` / `usa` / `america` | 美国     |
| `korea` / `kr`           | 韩国     |
| `taiwan` / `tw`          | 台湾     |
| `hongkong` / `hk`        | 香港     |

### 使用示例

```javascript
// 调用已声明的 API
const response = await Tapp.http.request({
  url: "https://api.example.com/data",
  method: "GET",
});
```

> 未在 `api_declarations` 中声明的端点将被拒绝访问。

---

## 权限列表

详细的权限说明请参考 [权限系统](./PERMISSIONS.md)。

### 基础权限（所有用户可用）

| 权限              | 说明           |
| ----------------- | -------------- |
| `storage`         | 本地数据存储   |
| `ui:notification` | 显示通知       |
| `ui:theme`        | 读取主题信息   |
| `ui:confirm`      | 显示确认对话框 |
| `ui:fullscreen`   | 请求全屏显示   |
| `platform:read`   | 读取平台数据   |
| `report:read`     | 读取报告       |
| `media:read`      | 读取媒体状态   |
| `event:subscribe` | 订阅系统事件   |
| `widget:register` | 注册小组件     |

### 提升权限（仅管理员可用）

| 权限                 | 说明           |
| -------------------- | -------------- |
| `platform:write`     | 写入平台数据   |
| `ai:generate`        | AI 文本生成    |
| `ai:analyze`         | AI 数据分析    |
| `ai:chat`            | AI 对话        |
| `ai:image`           | AI 图片生成    |
| `report:write`       | 创建/修改报告  |
| `network:fetch`      | 发送 HTTP 请求 |
| `media:control`      | 控制媒体播放   |
| `component:theme`    | 注册自定义主题 |
| `shortcut:register`  | 注册键盘快捷键 |
| `event:publish`      | 发布系统事件   |
| `scheduler:register` | 注册定时任务   |

### 特权权限

| 权限                | 说明           |
| ------------------- | -------------- |
| `platform:register` | 注册自定义平台 |
| `component:agent`   | 注册 AI Agent  |
