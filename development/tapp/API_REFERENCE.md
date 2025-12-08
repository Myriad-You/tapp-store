# Tapp API 参考

本文档提供 Tapp SDK 所有可用 API 的详细说明。

## 目录

- [存储 API](#存储-api)
- [设置 API](#设置-api)
- [UI API](#ui-api)
- [动画 API](#动画-api)
- [平台 API](#平台-api)
- [AI API](#ai-api)
- [小组件 API](#小组件-api)
- [报告 API](#报告-api)
- [DOM 安全 API](#dom-安全-api)
- [数据处理 API](#数据处理-api)
- [媒体控制 API](#媒体控制-api)
- [上下文 API](#上下文-api)
- [用户角色 API](#用户角色-api)
- [组件注册 API](#组件注册-api)
- [快捷键 API](#快捷键-api)
- [事件总线 API](#事件总线-api)
- [后台需求 API](#后台需求-api)
- [动态内容 API](#动态内容-api)
- [定时任务 API](#定时任务-api)

---

## 存储 API

**权限**: `storage`

```javascript
// 获取数据
const value = await Tapp.storage.get("key");

// 设置数据
await Tapp.storage.set("key", { any: "value" });

// 删除数据
await Tapp.storage.remove("key");

// 获取所有键
const keys = await Tapp.storage.keys();

// 清空存储
await Tapp.storage.clear();

// 获取存储使用情况
const usage = await Tapp.storage.usage();
// 返回: { used: 1024, quota: 5242880 } // 字节
```

---

## 设置 API

**权限**: `storage`（使用 `_settings.` 前缀存储）

```javascript
// 获取设置项
const refreshInterval = await Tapp.settings.get("refreshInterval");

// 设置设置项
await Tapp.settings.set("refreshInterval", 60);

// 获取所有设置
const allSettings = await Tapp.settings.getAll();
// 返回: { refreshInterval: 60, showDetails: true, ... }
```

---

## UI API

**权限**: `ui:notification`, `ui:theme`, `ui:confirm`, `ui:fullscreen`

### 基础 UI

```javascript
// 设置页面标题
await Tapp.ui.setTitle("我的页面");

// 显示通知（Toast）
await Tapp.ui.showNotification({
  title: "操作成功", // 可选：通知标题
  message: "数据已保存", // 必填：通知消息
  type: "success", // 可选：success | error | warning | info
  duration: 3000, // 可选：显示时长（毫秒）
});

// 确认对话框
const confirmed = await Tapp.ui.confirm("确定要执行吗？");
// 返回: true（确定）或 false（取消）
```

### 主题

```javascript
// 获取当前主题
const theme = await Tapp.ui.getTheme();
// 返回: 'light' | 'dark'

// 监听主题变化
const unsubscribe = Tapp.ui.onThemeChange((theme) => {
  console.log("主题切换为:", theme);
});

// 获取全局主色调（壁纸色）
const primaryColor = await Tapp.ui.getPrimaryColor();
// 返回: '#6366f1' (十六进制颜色值)

// 监听主色调变化
Tapp.ui.onPrimaryColorChange((color) => {
  console.log("主色调变化:", color);
});
```

### 语言

```javascript
// 获取当前语言
const locale = await Tapp.ui.getLocale();
// 返回: 'zh-CN' | 'en-US' | ...

// 监听语言变化
Tapp.ui.onLocaleChange((locale) => {
  console.log("语言切换为:", locale);
});
```

### 全屏

```javascript
// 请求全屏
await Tapp.ui.fullscreen.request();

// 退出全屏
await Tapp.ui.fullscreen.exit();

// 切换全屏
await Tapp.ui.fullscreen.toggle();

// 查询状态
const isFs = await Tapp.ui.fullscreen.isFullscreen();
```

---

## 动画 API

**权限**: 无需特殊权限

获取系统动画配置，根据用户偏好调整 UI 行为。

```javascript
// 获取当前动画级别
const level = await Tapp.animation.getLevel();
// 返回: 'none' | 'light' | 'standard'

// 检查是否应该显示动画
const shouldAnimate = await Tapp.animation.shouldAnimate();
// 返回: boolean

// 获取完整动画配置
const config = await Tapp.animation.getConfig();
// 返回: {
//   level: 'standard',
//   loop: true,
//   spring: { tension: 280, friction: 20 },
//   durationScale: 1
// }

// 获取推荐的交错延迟（用于列表动画）
const delay = await Tapp.animation.getStaggerDelay(index, baseDelay);
// index: 元素索引
// baseDelay: 基础延迟（毫秒），默认 50ms

// 监听动画级别变化
Tapp.animation.onLevelChange((level) => {
  console.log("动画级别变化:", level);
});
```

### 使用示例

```javascript
async function animateListItems(items) {
  const shouldAnimate = await Tapp.animation.shouldAnimate();
  const config = await Tapp.animation.getConfig();

  for (let i = 0; i < items.length; i++) {
    const delay = await Tapp.animation.getStaggerDelay(i);

    if (shouldAnimate) {
      setTimeout(() => {
        items[i].style.transition = `all ${200 * config.durationScale}ms`;
        items[i].classList.add("visible");
      }, delay);
    } else {
      items[i].classList.add("visible");
    }
  }
}
```

---

## 平台 API

**权限**: `platform:read`, `platform:write`

```javascript
// 获取已启用平台列表
const platforms = await Tapp.platform.listEnabled();
// 返回: [{ id: 'steam', name: 'Steam', enabled: true, ... }]

// 获取平台数据
const data = await Tapp.platform.getData("steam", {
  limit: 100,
  offset: 0,
});

// 获取平台统计
const stats = await Tapp.platform.getStats("steam");
// 返回: { total: 100, distribution: {...} }

// 获取数据分布
const dist = await Tapp.platform.getDistribution("steam", "genre");

// 添加数据条目（需要 platform:write 权限）
const result = await Tapp.platform.addItem({
  platform: "custom",
  type: "game",
  title: "我的游戏",
  description: "描述",
  metadata: { rating: 5 },
});

// 批量添加数据条目
await Tapp.platform.addItems([
  { platform: "custom", title: "游戏1" },
  { platform: "custom", title: "游戏2" },
]);
```

---

## AI API

**权限**: `ai:generate`, `ai:analyze`, `ai:chat`, `ai:image`

```javascript
// AI 生成
const response = await Tapp.ai.generate({
  prompt: "请帮我写一段介绍",
  context: { theme: "gaming" },
  options: { maxTokens: 500 },
});
// 返回: { success: true, result: '...', usage: {...} }

// AI 分析
const analysis = await Tapp.ai.analyze({
  data: [{ title: "Game 1" }, { title: "Game 2" }],
  type: "summarize", // summarize | categorize | sentiment | custom
  instruction: "自定义指令", // type 为 custom 时必填
});

// AI 对话
const chat = await Tapp.ai.chat(
  [{ role: "user", content: "你好" }], // messages
  { includePlatformStats: true }, // context (可选)
  { maxTokens: 1000 } // options (可选)
);
// 返回: {
//   message: { role: 'assistant', content: 'AI 回复内容' },
//   usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
//   sessionId: null  // 会话 ID（可选）
// }
// 注意：SDK 会自动解包，直接返回上述对象，不包含外层 success 字段

// AI 图片生成
const image = await Tapp.ai.image({
  prompt: "一只可爱的猫咪，动漫风格",
  width: 512,
  height: 768,
  model: "flux-anime", // flux | flux-anime | flux-realism | flux-3d
  enhance: true,
  seed: 12345,
});
// 返回: { success: true, provider: 'pollinations', url: '...' }

// 获取 AI 配额
const quota = await Tapp.ai.getQuota();
// 返回: { dailyCalls: 10, dailyTokens: 5000, lastReset: "..." }

// 检查是否可以生成
const canGen = await Tapp.ai.canGenerate();
// 返回: { allowed: true, remaining: 5 }
```

---

## 小组件 API

**权限**: `widget:register`

```javascript
// 注册小组件
await Tapp.widget.register({
  id: "my-widget",
  name: "我的小组件",
  defaultSize: "2x2",
  sizes: ["1x1", "2x2", "4x2"],
  minRefreshInterval: 60000,
  category: "tool",
});

// 注销小组件
await Tapp.widget.unregister("my-widget");

// 获取已注册小组件
const widgets = await Tapp.widget.listRegistered();

// 更新小组件配置
await Tapp.widget.updateConfig("my-widget", {
  title: "新标题",
});
```

---

## 报告 API

**权限**: `report:read`, `report:write`

```javascript
// 获取报告列表
const reports = await Tapp.report.list();
// 或: await Tapp.report.listReports();

// 获取报告详情
const report = await Tapp.report.get(reportId);
// 或: await Tapp.report.getReport(reportId);

// 获取特定平台的报告
const steamReport = await Tapp.report.getPlatformReport("steam");

// 创建报告（需要 report:write）
const newReport = await Tapp.report.create(
  "我的报告", // title
  "summary", // reportType
  { summary: "..." }, // content
  { tags: ["test"] } // metadata (可选)
);

// 更新报告
await Tapp.report.update(reportId, "新标题", { summary: "新内容" });

// 删除报告
await Tapp.report.delete(reportId);
```

---

## DOM 安全 API

**无需权限** - 防止 XSS 攻击的安全工具

```javascript
// HTML 转义
const safe = Tapp.dom.escapeHtml('<script>alert("xss")</script>');
// 返回: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'

// 安全设置文本内容
Tapp.dom.setText(element, userInput);

// 安全设置 HTML（自动转义）
Tapp.dom.setSafeHtml(element, userInput);

// 创建文本节点
const textNode = Tapp.dom.createTextNode(userInput);

// 安全设置属性
Tapp.dom.setAttribute(element, "href", url);

// 创建安全元素
const div = Tapp.dom.createElement("div", {
  text: "安全文本",
  className: "my-class",
  attributes: { "data-id": "123" },
});

// 安全渲染列表
Tapp.dom.renderList(container, items, (item, index) => {
  return Tapp.dom.createElement("div", {
    text: item.name,
    className: "item",
  });
});
```

> ⚠️ **安全警告**：永远不要直接使用 `innerHTML` 渲染用户输入！

---

## 数据处理 API

**无需权限** - 数据转换管道

```javascript
const result = await Tapp.data.transform({
  input: { source: "platform", platform: "steam" },
  pipeline: [
    { type: "filter", field: "status", operator: "eq", value: "active" },
    { type: "sort", field: "createdAt", order: "desc" },
    { type: "limit", count: 10 },
    { type: "select", fields: ["id", "title", "date"] },
  ],
  output: { target: "storage", key: "my-data" },
});
```

### 输入源类型

| 类型       | 参数               | 说明         |
| ---------- | ------------------ | ------------ |
| `platform` | `platform: string` | 从平台读取   |
| `storage`  | `key: string`      | 从存储读取   |
| `inline`   | `data: unknown`    | 直接传入数据 |

### 管道操作

| 操作        | 参数                         | 说明     |
| ----------- | ---------------------------- | -------- |
| `filter`    | `field`, `operator`, `value` | 过滤数据 |
| `sort`      | `field`, `order`             | 排序     |
| `limit`     | `count`                      | 限制数量 |
| `offset`    | `count`                      | 跳过数量 |
| `select`    | `fields`                     | 选择字段 |
| `group`     | `by`                         | 分组     |
| `aggregate` | `operation`, `field`         | 聚合统计 |
| `dedupe`    | `key`                        | 去重     |
| `map`       | `expression`                 | 映射转换 |

---

## 媒体控制 API

**权限**: `media:control`, `media:read`

```javascript
// 播放控制（需要 media:control）
await Tapp.media.play();
await Tapp.media.pause();
await Tapp.media.next();
await Tapp.media.prev();
await Tapp.media.seek(120); // 秒

// 音量控制
await Tapp.media.setVolume(0.8); // 0-1
await Tapp.media.mute();
await Tapp.media.unmute();

// 播放模式
await Tapp.media.setMode("repeat"); // repeat | shuffle | normal

// 播放指定曲目
await Tapp.media.playTrack(trackId, trackIndex);

// 获取播放状态（需要 media:read）
const status = await Tapp.media.getStatus();
// 返回: { isPlaying, currentTrack, position, volume, mode, muted }

// 获取播放列表
const playlist = await Tapp.media.getPlaylist();

// 监听状态变化
const unsubscribe = Tapp.media.onStateChange((state) => {
  console.log("播放状态:", state.isPlaying);
});
```

---

## 上下文 API

**无需权限** - 获取应用上下文信息

```javascript
// 获取应用信息
const app = await Tapp.context.getApp();
// 返回: { version, name, environment }

// 获取用户信息
const user = await Tapp.context.getUser();
// 返回: { id, username, avatar, preferences }

// 获取播放器信息
const player = await Tapp.context.getPlayer();
// 返回: { isPlaying, currentTrack, volume }

// 获取导航信息
const nav = await Tapp.context.getNavigation();
// 返回: { currentPath, params }

// 获取系统信息
const system = await Tapp.context.getSystem();
// 返回: { theme, language, timezone }
```

---

## 用户角色 API

**无需权限** - 获取当前用户的角色信息

```javascript
// 获取当前用户角色
const role = await Tapp.user.getRole();
// 返回: "guest" | "user" | "admin"

// 检查是否为管理员
const isAdmin = await Tapp.user.isAdmin();

// 检查是否为游客
const isGuest = await Tapp.user.isGuest();

// 检查是否已登录
const isLoggedIn = await Tapp.user.isLoggedIn();

// 获取可用的权限等级
const levels = await Tapp.user.getAllowedPermissionLevels();
// admin -> ['public', 'basic', 'elevated', 'privileged']
// user  -> ['public', 'basic']
// guest -> ['public']

// 检查是否可以使用指定权限等级
const canUse = await Tapp.user.canUsePermissionLevel("elevated");
```

---

## 组件注册 API

**权限**: `component:theme`, `component:agent`

```javascript
// 注册自定义主题
await Tapp.component.registerTheme({
  id: "my-theme",
  name: "我的主题",
  colors: {
    primary: "#6366f1",
    background: "#1a1a2e",
  },
});

// 注册 AI Agent
await Tapp.component.registerAgent({
  id: "my-agent",
  name: "我的助手",
  description: "一个自定义 AI 助手",
  capabilities: ["chat", "analyze"],
});

// 注销组件
await Tapp.component.unregister("page", "my-page");

// 列出已注册组件
const pages = await Tapp.component.list("page");
```

---

## 快捷键 API

**权限**: `shortcut:register`

```javascript
// 注册快捷键
await Tapp.shortcut.register({
  id: "my-shortcut",
  keys: "Ctrl+Shift+M",
  description: "打开我的 Tapp",
  action: "open-tapp",
  scope: "global", // global | tapp | editor
});

// 监听快捷键触发
Tapp.event.on("shortcut:triggered", (data) => {
  if (data.shortcutId === "my-shortcut") {
    console.log("快捷键已触发:", data.action);
  }
});

// 注销快捷键
await Tapp.shortcut.unregister("my-shortcut");

// 列出已注册快捷键
const shortcuts = await Tapp.shortcut.list();
```

---

## 事件总线 API

**权限**: `event:subscribe`, `event:publish`

```javascript
// 订阅事件
await Tapp.event.subscribe(["user:login", "platform:sync"]);

// 监听事件
const unsubscribe = Tapp.event.on("user:login", (payload) => {
  console.log("用户登录:", payload.username);
});

// 发布事件（需要 event:publish）
await Tapp.event.publish(
  "my-event",
  { message: "Hello!" },
  "broadcast" // broadcast | self | tappId
);

// 取消订阅
await Tapp.event.unsubscribe(["user:login"]);
unsubscribe();
```

---

## 后台需求 API

**无需权限** - 声明 Tapp 的后台运行需求

```javascript
// 声明后台运行需求
await Tapp.background.require("sync", "每5分钟同步数据");

// 释放后台运行需求
await Tapp.background.release("sync");

// 获取当前所有后台需求
const requirements = await Tapp.background.list();
// 返回: ['widget', 'sync']

// 检查是否有特定后台需求
const hasSync = await Tapp.background.has("sync");
```

### 需求类型

| 类型             | 说明               |
| ---------------- | ------------------ |
| `widget`         | 有小组件在主页显示 |
| `media`          | 媒体控制功能       |
| `sync`           | 后台数据同步       |
| `notification`   | 定时通知功能       |
| `scheduler`      | 定时任务执行       |
| `event-listener` | 跨 Tapp 事件监听   |
| `realtime`       | 实时数据更新       |

---

## 动态内容 API

**权限**: `ui:notification`

在控制岛显示动态内容（如歌词、天气、统计等）。

```javascript
// 设置动态内容
await Tapp.dynamicContent.set({
  icon: "📊",
  text: "今日活跃: 128",
  subtext: "较昨日 +15%",
  priority: 10,
  expiresAt: Date.now() + 3600000, // 1小时后过期
  i18n: {
    text: {
      "zh-CN": "今日活跃: 128",
      "en-US": "Active today: 128",
    },
  },
});

// 快速更新文本
await Tapp.dynamicContent.update({
  text: "今日活跃: 156",
  subtext: "较昨日 +22%",
});

// 获取当前动态内容
const content = await Tapp.dynamicContent.get();

// 移除动态内容
await Tapp.dynamicContent.remove();
```

---

## 定时任务 API

**权限**: `scheduler:register`

```javascript
// 注册定时任务
await Tapp.scheduler.register({
  taskId: "daily-sync",
  name: "每日数据同步",
  scheduleType: "daily", // cron | interval | once | daily
  schedule: { time: "09:00" },
  executionTarget: "backend", // backend | frontend | both
  backendActions: [{ type: "platform.sync", platform: "steam" }],
  missedPolicy: "run-once", // skip | run-once | run-all
});

// 注册间隔任务
await Tapp.scheduler.register({
  taskId: "refresh",
  name: "刷新数据",
  scheduleType: "interval",
  schedule: { interval: 5 * 60 * 1000 }, // 5分钟
  executionTarget: "frontend",
});

// 注销任务
await Tapp.scheduler.unregister("daily-sync");

// 获取任务列表
const tasks = await Tapp.scheduler.list();

// 获取单个任务
const task = await Tapp.scheduler.get("daily-sync");

// 启用/禁用任务
await Tapp.scheduler.enable("daily-sync");
await Tapp.scheduler.disable("daily-sync");

// 手动触发任务
await Tapp.scheduler.trigger("daily-sync");

// 监听任务执行（前端任务）
const unsubscribe = Tapp.scheduler.onTask("refresh", async (payload) => {
  await refreshData();
});
```

### 调度类型

| 类型       | 配置参数   | 示例                            |
| ---------- | ---------- | ------------------------------- |
| `cron`     | `cron`     | `'0 9 * * 1'` - 每周一上午 9 点 |
| `interval` | `interval` | `300000` - 每 5 分钟            |
| `once`     | `at`       | 时间戳（毫秒）                  |
| `daily`    | `time`     | `'09:00'` - 每天上午 9 点       |

### 后端操作类型

```javascript
// 平台数据同步
{ type: 'platform.sync', platform: 'steam' }

// 存储操作
{ type: 'storage.set', key: 'key', value: { data: 1 } }
{ type: 'storage.delete', key: 'key' }
{ type: 'storage.get', key: 'key' }

// AI 生成
{ type: 'ai.generate', prompt: '生成摘要' }

// HTTP 请求
{ type: 'fetch', url: '...', method: 'GET', headers: {...} }

// 队列通知
{ type: 'notification.queue', title: '提醒', message: '...' }

// 数据转换
{ type: 'transform', input: 'varName', extract: '$.data' }
```
