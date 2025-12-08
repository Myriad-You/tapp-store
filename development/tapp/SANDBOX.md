# 安全沙箱

本文档说明 Tapp 的安全机制和运行环境限制。

## 概述

每个 Tapp 运行在严格隔离的 iframe 沙箱中，具有多层安全保护：

1. **iframe 沙箱属性**：限制 iframe 能力
2. **内容安全策略 (CSP)**：控制资源加载和代码执行
3. **全局对象保护**：阻止直接 DOM 操作
4. **API 网关**：所有操作通过受控 SDK 进行

---

## iframe 沙箱属性

```html
<iframe
  sandbox="allow-scripts allow-forms allow-popups allow-same-origin allow-modals"
  referrerpolicy="no-referrer"
  credentialless
></iframe>
```

### 允许的能力

| 属性                | 说明                   |
| ------------------- | ---------------------- |
| `allow-scripts`     | 允许执行 JavaScript    |
| `allow-forms`       | 允许提交表单           |
| `allow-popups`      | 允许弹出窗口           |
| `allow-same-origin` | 允许同源访问           |
| `allow-modals`      | 允许使用 alert/confirm |

### 禁止的能力

| 能力                     | 说明                |
| ------------------------ | ------------------- |
| `allow-top-navigation`   | ❌ 不能导航顶级窗口 |
| `allow-pointer-lock`     | ❌ 不能锁定鼠标指针 |
| `allow-orientation-lock` | ❌ 不能锁定屏幕方向 |
| `allow-presentation`     | ❌ 不能使用演示模式 |

---

## 内容安全策略 (CSP)

### 完整 CSP 配置

```
default-src 'self';
script-src 'unsafe-inline' 'unsafe-eval' blob:;
style-src 'unsafe-inline' *;
img-src * data: blob:;
media-src *;
font-src * data:;
connect-src *;
frame-src 'none';
object-src 'none';
base-uri 'none';
```

### 策略说明

| 指令          | 值                              | 说明                         |
| ------------- | ------------------------------- | ---------------------------- |
| `default-src` | `'self'`                        | 默认只允许同源资源           |
| `script-src`  | `'unsafe-inline' 'unsafe-eval'` | 允许内联脚本（必需）         |
| `style-src`   | `'unsafe-inline' *`             | 允许内联样式和任意来源       |
| `img-src`     | `* data: blob:`                 | 允许任意图片来源             |
| `connect-src` | `*`                             | 允许连接任意后端（通过代理） |
| `frame-src`   | `'none'`                        | ❌ 禁止嵌入 iframe           |
| `object-src`  | `'none'`                        | ❌ 禁止 object/embed/applet  |
| `base-uri`    | `'none'`                        | ❌ 禁止修改 base URI         |

---

## 全局对象保护

Tapp 运行时会劫持危险的全局对象和方法：

### 被阻止的操作

```javascript
// ❌ 这些操作会被阻止或抛出错误

// 网络请求 - 必须使用 Tapp.http
fetch("https://api.example.com"); // 阻止
XMLHttpRequest; // 阻止

// 存储 - 必须使用 Tapp.storage
localStorage.setItem("key", "value"); // 无效
sessionStorage.getItem("key"); // 无效

// 导航 - 禁止修改
window.location.href = "https://evil.com"; // 阻止
window.history.pushState(); // 阻止

// 窗口操作
window.open("https://evil.com"); // 受限
window.parent.postMessage(); // 需要特定格式

// Cookie
document.cookie; // 不可访问（credentialless）
```

### 替代方案

| 被阻止的 API               | 替代方案                 |
| -------------------------- | ------------------------ |
| `fetch` / `XMLHttpRequest` | `Tapp.http.request()`    |
| `localStorage`             | `Tapp.storage.set/get()` |
| `sessionStorage`           | `Tapp.storage.set/get()` |
| `document.cookie`          | 不可用                   |
| `window.open`              | `Tapp.ui.openUrl()`      |

---

## DOM 安全

### 危险方法

```javascript
// ❌ 直接使用 innerHTML 有 XSS 风险
container.innerHTML = `<div>${userInput}</div>`;

// ❌ 直接拼接 HTML
element.insertAdjacentHTML("beforeend", userInput);
```

### 安全方法

```javascript
// ✅ 使用 SDK 提供的安全方法
const div = Tapp.dom.createElement("div", { className: "safe" });
Tapp.dom.setText(div, userInput); // 自动转义

// ✅ 使用 textContent
element.textContent = userInput;

// ✅ 使用安全列表渲染
Tapp.dom.renderList(container, items, (item) => {
  return Tapp.dom.createElement("li", { text: item.name });
});
```

---

## 权限系统

Tapp 需要在 manifest 中声明所需权限：

### 权限级别

| 级别 | 说明           | 示例权限                     |
| ---- | -------------- | ---------------------------- |
| 基础 | 默认授予       | `storage`, `ui`, `theme`     |
| 提升 | 需要用户确认   | `platform.read`, `ai.chat`   |
| 特权 | 需要管理员审核 | `system.admin`, `http.write` |

### 权限检查

运行时会验证每个 API 调用的权限：

```javascript
// 如果未声明权限，API 调用会失败
try {
  await Tapp.ai.chat([...]); // 需要 ai.chat 权限
} catch (e) {
  console.error("权限不足:", e.message);
}
```

---

## API 声明系统

### 基本结构

```json
{
  "api_declarations": [
    {
      "endpoint": "https://api.example.com/data",
      "methods": ["GET"],
      "description": "获取数据"
    }
  ]
}
```

### Spoof 模式

允许隐藏真实 API 端点，防止分析：

```json
{
  "api_declarations": [
    {
      "endpoint": "https://api.example.com/secret",
      "methods": ["GET", "POST"],
      "spoof": {
        "enabled": true,
        "display_endpoint": "https://public.example.com/api"
      }
    }
  ]
}
```

用户看到的信息：

```
API 访问：https://public.example.com/api
方法：GET, POST
```

---

## 资源限制

### 存储配额

| 类型     | 限制           |
| -------- | -------------- |
| 存储空间 | 5 MB / Tapp    |
| 键值对   | 1000 个 / Tapp |
| 键长度   | 256 字符       |
| 值大小   | 1 MB / 条      |

### 执行限制

| 类型         | 限制        |
| ------------ | ----------- |
| API 调用频率 | 100 次/分钟 |
| 后台任务     | 10 个/Tapp  |
| 定时任务     | 5 个/Tapp   |

---

## 最佳实践

### 1. 始终验证输入

```javascript
function processUserInput(input) {
  // 验证类型
  if (typeof input !== "string") {
    throw new Error("Invalid input type");
  }

  // 限制长度
  if (input.length > 1000) {
    input = input.substring(0, 1000);
  }

  // 使用安全方法渲染
  Tapp.dom.setText(element, input);
}
```

### 2. 最小权限原则

```json
{
  "permissions": {
    // 只申请必需的权限
    "basic": ["storage", "ui.theme"],
    "elevated": ["platform.read"]
    // 不要申请不需要的权限
  }
}
```

### 3. 错误处理

```javascript
try {
  const data = await Tapp.http.request({
    url: "/api/data",
    method: "GET",
  });
} catch (error) {
  // 不要暴露敏感信息
  Tapp.ui.notify({
    type: "error",
    message: "获取数据失败，请稍后重试",
  });

  // 记录详细错误用于调试
  console.error("API Error:", error.code);
}
```

### 4. 避免敏感数据泄露

```javascript
// ❌ 不要在控制台打印敏感信息
console.log("API Key:", apiKey);
console.log("User Data:", userData);

// ✅ 只打印必要的调试信息
console.log("Request status:", response.status);
```

---

## 安全事件处理

如果检测到安全违规，系统会：

1. **阻止操作**：危险操作不会执行
2. **记录日志**：违规行为会被记录
3. **通知用户**：严重违规会通知用户
4. **禁用 Tapp**：反复违规可能导致 Tapp 被禁用

```javascript
// 示例：违规日志
{
  "tappId": "com.example.bad-tapp",
  "violation": "CSP_VIOLATION",
  "blockedUri": "https://malicious.com/script.js",
  "timestamp": "2024-01-15T10:30:00Z"
}
```
