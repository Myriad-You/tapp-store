# 样式规范

本文档介绍 Tapp 的样式系统、CSS 变量、工具类和最佳实践。

## CSS 变量系统

Tapp 继承主应用的 CSS 变量，支持亮色/暗色主题自动切换：

### 主题颜色

> **重要**：深色模式使用纯黑色系（`neutral`），不使用带蓝色调的颜色（`gray`, `slate`）。

```css
:root {
  /* 背景色 */
  --tapp-bg-primary: #ffffff;
  --tapp-bg-secondary: #f9fafb;
  --tapp-bg-tertiary: #f5f5f5;

  /* 文字色 */
  --tapp-text-primary: #171717;
  --tapp-text-secondary: #404040;
  --tapp-text-muted: #737373;

  /* 强调色 */
  --tapp-accent: #6366f1;
  --tapp-accent-hover: #4f46e5;

  /* 边框 */
  --tapp-border: #e5e5e5;
  --tapp-border-focus: #6366f1;
}

.dark {
  /* 纯黑色系背景 - 不使用带蓝色调的 gray/slate */
  --tapp-bg-primary: #171717; /* neutral-900 */
  --tapp-bg-secondary: #0a0a0a; /* neutral-950 */
  --tapp-bg-tertiary: #000000; /* 纯黑 */

  --tapp-text-primary: #fafafa;
  --tapp-text-secondary: #e5e5e5;
  --tapp-text-muted: #a3a3a3;

  --tapp-accent: #818cf8;
  --tapp-accent-hover: #6366f1;

  --tapp-border: #404040; /* neutral-700 */
  --tapp-border-focus: #818cf8;
}
```

### 使用示例

```css
.my-card {
  background: var(--tapp-bg-primary);
  color: var(--tapp-text-primary);
  border: 1px solid var(--tapp-border);
}

.my-button {
  background: var(--tapp-accent);
  color: white;
}

.my-button:hover {
  background: var(--tapp-accent-hover);
}
```

---

## Tailwind CSS 集成

Tapp 完整支持 Tailwind CSS，可直接使用所有工具类：

### 布局

```html
<!-- Flexbox -->
<div class="flex items-center justify-between gap-4">
  <span>左侧</span>
  <span>右侧</span>
</div>

<!-- Grid -->
<div class="grid grid-cols-2 gap-3">
  <div>单元格 1</div>
  <div>单元格 2</div>
</div>
```

### 响应式

```html
<div class="flex flex-col md:flex-row">
  <!-- 移动端纵向，桌面端横向 -->
</div>
```

### 暗色模式

> **注意**：深色模式使用 `neutral` 色系（纯中性灰），不使用 `gray`（带蓝色调）。

```html
<div class="bg-white dark:bg-neutral-800">
  <p class="text-neutral-800 dark:text-neutral-100">自动切换主题</p>
</div>
```

---

## Glass 风格

Myriad 使用统一的 Glass（毛玻璃）设计语言：

### 基础 Glass 容器

```html
<div class="glass rounded-xl p-4">
  <!-- 内容 -->
</div>
```

### 手动实现

> **重要**：深色模式背景使用纯黑/中性灰，不带蓝色调。

```css
.glass {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.dark .glass {
  background: rgba(26, 26, 26, 0.8); /* 纯黑 #1a1a1a */
  border: 1px solid rgba(255, 255, 255, 0.05);
}
```

### 层次变化

> **注意**：深色模式使用白色透明度创建层次，而非带蓝色调的 gray。

```html
<!-- 一级容器 -->
<div class="bg-white/60 dark:bg-black/80">
  <!-- 二级容器 -->
  <div class="bg-white/40 dark:bg-white/5">
    <!-- 三级容器 -->
    <div class="bg-neutral-50/30 dark:bg-white/10">
      <!-- 内容 -->
    </div>
  </div>
</div>
```

---

## 颜色透明度

使用 Tailwind 透明度语法创建层次感：

### 背景透明度

```html
<!-- 数值透明度 -->
<div class="bg-white/60">60% 白色</div>
<div class="bg-white/40">40% 白色</div>

<!-- 暗色模式低透明度 -->
<div class="dark:bg-white/[0.03]">3% 白色</div>
<div class="dark:bg-white/[0.05]">5% 白色</div>
```

### 渐变背景

```html
<!-- 装饰渐变 -->
<div
  class="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent"
></div>

<!-- 暗色渐变 -->
<div
  class="absolute inset-0 bg-gradient-to-br from-violet-500/10 dark:from-violet-500/5 to-transparent"
></div>
```

---

## 字体规范

### 字号层级

| 用途     | Tailwind 类   | 实际大小 |
| -------- | ------------- | -------- |
| 超大数字 | `text-4xl`    | 36px     |
| 大数字   | `text-3xl`    | 30px     |
| 大标题   | `text-2xl`    | 24px     |
| 标题     | `text-xl`     | 20px     |
| 副标题   | `text-lg`     | 18px     |
| 正文     | `text-base`   | 16px     |
| 小文本   | `text-sm`     | 14px     |
| 辅助文本 | `text-xs`     | 12px     |
| 微型文本 | `text-[10px]` | 10px     |

### 字重

```html
<span class="font-black">极粗 (900)</span>
<span class="font-bold">粗体 (700)</span>
<span class="font-semibold">半粗 (600)</span>
<span class="font-medium">中等 (500)</span>
<span class="font-normal">正常 (400)</span>
```

### 动态缩放

Widget 中根据 `fontScale` 调整字号：

```javascript
const fontScale = props.fontScale || 1;

container.innerHTML = `
  <span style="font-size: ${16 * fontScale}px;">动态文字</span>
`;
```

---

## 间距规范

### 标准间距

| Tailwind | 像素 | 用途       |
| -------- | ---- | ---------- |
| `p-1`    | 4px  | 紧凑内边距 |
| `p-2`    | 8px  | 小内边距   |
| `p-3`    | 12px | 标准内边距 |
| `p-4`    | 16px | 舒适内边距 |
| `gap-2`  | 8px  | 小间隙     |
| `gap-3`  | 12px | 标准间隙   |
| `gap-4`  | 16px | 大间隙     |
| `mt-2`   | 8px  | 小外边距   |
| `mb-4`   | 16px | 段落间距   |

### 动态缩放

Widget 中根据 `scale` 调整间距：

```javascript
const scale = props.scale || 1;

container.innerHTML = `
  <div style="padding: ${12 * scale}px; gap: ${8 * scale}px;">
    内容
  </div>
`;
```

---

## 圆角规范

| Tailwind       | 像素 | 用途   |
| -------------- | ---- | ------ |
| `rounded`      | 4px  | 小元素 |
| `rounded-md`   | 6px  | 按钮   |
| `rounded-lg`   | 8px  | 卡片   |
| `rounded-xl`   | 12px | 大卡片 |
| `rounded-2xl`  | 16px | 对话框 |
| `rounded-full` | 50%  | 圆形   |

---

## 阴影规范

```html
<!-- 基础阴影 -->
<div class="shadow-sm">轻微阴影</div>
<div class="shadow">标准阴影</div>
<div class="shadow-lg">大阴影</div>

<!-- 配合 Glass -->
<div class="glass shadow-lg">毛玻璃 + 阴影</div>
```

---

## 自适应尺寸

### 容器查询

```css
/* 根据容器宽度调整布局 */
@container (max-width: 200px) {
  .widget-content {
    flex-direction: column;
  }
}

@container (min-width: 400px) {
  .widget-content {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

### JavaScript 实现

```javascript
Tapp.widgets["adaptive"] = {
  render: function (container, props) {
    const size = props.size || "2x2";
    const scale = props.scale || 1;

    const isCompact = scale < 0.8;
    const isLarge = scale > 1.5;

    if (isCompact) {
      // 紧凑布局
    } else if (isLarge) {
      // 放大布局
    } else {
      // 标准布局
    }
  },
};
```

---

## 页面层级架构

Tapp Page 使用多层架构实现复杂交互：

### 层级结构

```
┌─────────────────────────────────────────────┐
│  顶层：模态框 / Toast (z-50+)               │
├─────────────────────────────────────────────┤
│  覆盖层：弹出菜单 / 下拉框 (z-30-40)         │
├─────────────────────────────────────────────┤
│  固定层：导航栏 / 工具栏 (z-20)              │
├─────────────────────────────────────────────┤
│  浮动层：悬浮按钮 / 标签 (z-10)              │
├─────────────────────────────────────────────┤
│  内容层：主要内容 (z-0)                      │
├─────────────────────────────────────────────┤
│  装饰层：渐变背景 / 光效 (z-[-1])            │
└─────────────────────────────────────────────┘
```

### z-index 规范

| 层级   | z-index 范围 | 用途               |
| ------ | ------------ | ------------------ |
| 装饰层 | -1           | 背景渐变、装饰元素 |
| 内容层 | 0            | 主要内容           |
| 浮动层 | 10           | 浮动按钮、标签     |
| 固定层 | 20           | 导航栏、工具栏     |
| 覆盖层 | 30-40        | 弹出菜单、下拉框   |
| 顶层   | 50+          | 模态框、Toast      |

### 实现示例

```html
<div class="relative h-full">
  <!-- 装饰层 -->
  <div
    class="absolute inset-0 z-[-1] bg-gradient-to-br from-indigo-500/5 to-transparent"
  ></div>

  <!-- 内容层 -->
  <div class="relative z-0">
    <main>主要内容</main>
  </div>

  <!-- 固定层 -->
  <nav class="fixed top-0 left-0 right-0 z-20 glass">导航栏</nav>

  <!-- 浮动层 -->
  <button
    class="fixed bottom-4 right-4 z-10 rounded-full bg-indigo-500 p-3"
  ></button>
</div>
```

---

## 动画效果

### 过渡

```html
<!-- 基础过渡 -->
<div class="transition-all duration-200 ease-in-out">...</div>

<!-- 颜色过渡 -->
<button class="transition-colors hover:bg-indigo-600">按钮</button>

<!-- 变换过渡 -->
<div class="transition-transform hover:scale-105">卡片</div>
```

### 动画类

```html
<!-- 淡入 -->
<div class="animate-fade-in">...</div>

<!-- 弹跳 -->
<div class="animate-bounce">...</div>

<!-- 脉冲 -->
<div class="animate-pulse">加载中...</div>

<!-- 旋转 -->
<div class="animate-spin">🔄</div>
```

### 使用 Tapp.animation

```javascript
await Tapp.animation.run(element, "fadeIn", { duration: 300 });
await Tapp.animation.run(element, "slideUp", { duration: 200 });
await Tapp.animation.run(element, "bounce", { iterations: 3 });
```

---

## 组件样式

### 按钮

```html
<!-- 主要按钮 -->
<button
  class="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium 
         hover:bg-indigo-700 transition-colors"
>
  主要操作
</button>

<!-- 次要按钮 -->
<button
  class="px-4 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-700 
         text-neutral-700 dark:text-neutral-200 font-medium 
         hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
>
  次要操作
</button>

<!-- 透明按钮 -->
<button
  class="px-4 py-2 rounded-lg bg-transparent 
         text-indigo-600 dark:text-indigo-400 font-medium 
         hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
>
  透明按钮
</button>
```

### 输入框

```html
<input
  type="text"
  class="w-full px-3 py-2 rounded-lg 
         bg-white dark:bg-neutral-800 
         border border-neutral-200 dark:border-neutral-700 
         text-neutral-800 dark:text-neutral-100 
         placeholder-neutral-400 
         focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 
         transition-all outline-none"
  placeholder="输入内容..."
/>
```

### 卡片

```html
<div class="glass rounded-xl p-4">
  <h3 class="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-2">
    卡片标题
  </h3>
  <p class="text-neutral-600 dark:text-neutral-400">卡片内容描述文字。</p>
</div>
```

### 列表

```html
<ul class="divide-y divide-neutral-100 dark:divide-neutral-800">
  <li
    class="py-3 px-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
  >
    列表项 1
  </li>
  <li
    class="py-3 px-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
  >
    列表项 2
  </li>
</ul>
```

---

## 最佳实践

### 1. 保持一致性

```html
<!-- ✅ 使用统一的圆角和间距 -->
<div class="rounded-xl p-4">
  <div class="rounded-lg p-3">
    <div class="rounded-md p-2"></div>
  </div>
</div>
```

### 2. 响应主题变化

```javascript
// 监听主题变化
Tapp.ui.onThemeChange((theme) => {
  updateStyles(theme);
});

// 或直接使用 dark: 类
`<div class="bg-white dark:bg-gray-800">...</div>`;
```

### 3. 避免硬编码颜色

```html
<!-- ❌ 避免 -->
<div style="color: #333333;">...</div>

<!-- ✅ 使用 Tailwind 或 CSS 变量 -->
<div class="text-gray-700 dark:text-gray-300">...</div>
```

### 4. 使用语义化颜色

```html
<!-- ✅ 状态颜色 -->
<span class="text-green-600 dark:text-green-400">成功</span>
<span class="text-red-600 dark:text-red-400">错误</span>
<span class="text-yellow-600 dark:text-yellow-400">警告</span>
<span class="text-blue-600 dark:text-blue-400">信息</span>
```

### 5. 测试不同尺寸

```javascript
// 确保在所有尺寸下都能正常显示
const sizes = ["1x1", "2x1", "2x2", "4x2", "4x4"];
sizes.forEach((size) => {
  // 测试每个尺寸
});
```
