# 音乐播放器 Tapp

功能完整的音乐播放器，支持歌词显示、播放列表和多种播放模式。

## 功能特性

- 🎵 **完整播放控制** - 播放/暂停、上一首/下一首、进度拖动
- 📜 **歌词显示** - 同步歌词显示，自动滚动跟随
- 📋 **播放列表** - 查看和管理播放列表，支持搜索
- 🔀 **播放模式** - 列表循环、单曲循环、随机播放
- 🔊 **音量控制** - 调节音量、静音切换
- 🎨 **自适应主题** - 跟随系统深色/浅色模式
- 📱 **响应式布局** - 适配不同屏幕尺寸

## 界面布局

```
┌─────────────────────────────────────────┐
│  ┌─────────────┐  ┌──────────────────┐  │
│  │             │  │                  │  │
│  │   封面      │  │     歌词         │  │
│  │   信息      │  │                  │  │
│  │   控制      │  ├──────────────────┤  │
│  │             │  │                  │  │
│  │             │  │   播放列表       │  │
│  │             │  │                  │  │
│  └─────────────┘  └──────────────────┘  │
└─────────────────────────────────────────┘
```

- **左侧**: 专辑封面、歌曲信息、进度条、播放控制
- **右上**: 歌词显示区域，自动滚动高亮当前行
- **右下**: 播放列表，支持搜索过滤

## 使用的 API

### 媒体控制 API (`media:control`)

```javascript
// 播放控制
Tapp.media.play();
Tapp.media.pause();
Tapp.media.next();
Tapp.media.prev();
Tapp.media.seek(seconds);

// 音量控制
Tapp.media.setVolume(0.8);
Tapp.media.mute();
Tapp.media.unmute();

// 播放模式
Tapp.media.setMode('repeat'); // repeat | single | shuffle

// 播放指定曲目
Tapp.media.playTrack(trackId, trackIndex);
```

### 媒体读取 API (`media:read`)

```javascript
// 获取播放状态
const status = await Tapp.media.getStatus();
// { isPlaying, currentTrack, position, volume, mode, muted }

// 获取播放列表
const playlist = await Tapp.media.getPlaylist();

// 监听状态变化
Tapp.media.onStateChange((state) => {
  console.log('播放状态:', state);
});
```

## 权限要求

| 权限 | 用途 |
|------|------|
| `storage` | 保存用户设置 |
| `ui:notification` | 显示通知提示 |
| `ui:theme` | 获取主题和颜色 |
| `media:control` | 控制音乐播放 |
| `media:read` | 读取播放状态 |

## 设置选项

| 设置 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `showLyrics` | toggle | true | 显示歌词面板 |
| `autoScroll` | toggle | true | 歌词自动滚动 |
| `showSpectrum` | toggle | true | 显示频谱动画 |

## 多语言支持

- 🇨🇳 简体中文
- 🇺🇸 English
- 🇯🇵 日本語

## 开发者

- **作者**: Myriad Team
- **版本**: 1.0.0
- **许可**: MIT
