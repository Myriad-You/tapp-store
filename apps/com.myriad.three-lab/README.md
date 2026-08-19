# Three 实验室

官方 Three.js 示例 Page。演示 Tapp 沙箱里怎么用 WebGL 库，而不是把 Three 打进宿主。

## 做什么

- 把 `three` 打成 `page/scene.js` IIFE，经 `manifest.pageModules` 加载
- 先 `Tapp.assets.getUrlMap()`，再用 `rewriteUrl` 接 Three `LoadingManager`
- 棋盘贴图与立方体都走包内路径，不走 CDN
- `onPause` 停 rAF；`onDestroy` 里 `dispose` 并 `revokeAll`
- 商店预览是无脚本的 CSS 立方体

## 构建

```bash
cd apps/com.myriad.three-lab
npm install
npm run build
npm test
```

`three` 只是 devDependency。安装包只带 `page/scene.js` 和 `assets/`。

## 不要做的

- 从 CDN / `unpkg` / `jsdelivr` 加载 Three
- 在 Widget 里跑这个场景
- 给预览 iframe 加 `<script>`

约定见 Myriad [GRAPHICS.md](../../development/tapp/GRAPHICS.md)。

Three.js 为 MIT，见上游许可证。本应用其余代码为 MIT。
