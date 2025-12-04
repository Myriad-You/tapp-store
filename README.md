# Myriad Tapp Store

官方 Tapp 应用商店，托管在 GitHub 上。

## 使用方法

### 添加应用源

在 Myriad 应用中添加以下应用源 URL：

```
https://raw.githubusercontent.com/Myriad-You/tapp-store/main/index.json
```

### API 结构

#### 获取应用列表

```
GET {base_url}/index.json
```

返回所有应用的索引信息。

#### 获取应用详情

```
GET {base_url}/apps/{app_id}/manifest.json
```

返回应用的完整清单。

#### 下载应用代码

```
GET {base_url}/apps/{app_id}/index.js
```

返回应用的 JavaScript 代码。

## 文件结构

```
tapp-store/
├── index.json              # 应用索引（必需）
├── categories.json         # 分类定义
├── README.md               # 本文件
└── apps/
    └── {app_id}/
        ├── manifest.json   # 应用清单（必需）
        ├── index.js        # 应用代码（必需）
        ├── README.md       # 应用说明
        └── icon.png        # 应用图标（可选）
```

## index.json 结构

```jsonc
{
  "$schema": "https://myriad.app/schemas/tapp-store-v1.json",
  "name": "商店名称",
  "version": "1.0.0",
  "api_version": "1",
  "base_url": "https://raw.githubusercontent.com/Myriad-You/tapp-store/main",
  "updated_at": "2025-12-04T00:00:00Z",
  "maintainer": {
    "name": "Myriad Team",
    "email": "tapp@myriad.app",
    "url": "https://github.com/Myriad-You"
  },
  "apps": [
    {
      // 必需字段
      "id": "com.example.app", // 应用唯一 ID（反向域名格式）
      "name": "应用名称",
      "version": "1.0.0",
      "description": "简短描述",
      "author": { "name": "作者" },
      "category": "productivity", // 分类
      "permissions": ["storage"], // 所需权限
      "icon": "📱", // Emoji 图标
      "download": {
        "manifest": "apps/com.example.app/manifest.json",
        "code": "apps/com.example.app/index.js"
      },

      // 可选字段
      "long_description": "详细描述...",
      "license": "MIT",
      "homepage": "https://...",
      "repository": "https://...",
      "tags": ["标签1", "标签2"],
      "min_myriad_version": "1.0.0",
      "theme_color": "#FF66AB",
      "screenshots": ["url1", "url2"],
      "size": 12345, // 字节
      "downloads": 100,
      "rating": 4.5,
      "featured": true, // 是否推荐
      "verified": true, // 是否官方验证
      "created_at": "2025-12-04T00:00:00Z",
      "updated_at": "2025-12-04T00:00:00Z"
    }
  ]
}
```

## 分类

| ID             | 名称     | 描述               |
| -------------- | -------- | ------------------ |
| `productivity` | 效率工具 | 提升工作效率的工具 |
| `ai`           | AI 应用  | 人工智能相关应用   |
| `developer`    | 开发工具 | 开发者工具         |
| `games`        | 游戏     | 休闲娱乐游戏       |
| `data`         | 数据管理 | 数据处理和展示     |
| `social`       | 社交     | 社交相关功能       |
| `utility`      | 实用工具 | 通用工具类         |

## 权限说明

| 权限              | 描述         | 级别     |
| ----------------- | ------------ | -------- |
| `storage`         | 本地数据存储 | public   |
| `ui:notification` | 显示通知     | public   |
| `ui:theme`        | 读取主题设置 | public   |
| `widget:register` | 注册小组件   | basic    |
| `component:page`  | 注册页面     | basic    |
| `network:fetch`   | 发起网络请求 | elevated |
| `ai:generate`     | 调用 AI 生成 | elevated |
| `media:read`      | 读取媒体信息 | basic    |
| `media:control`   | 控制媒体播放 | elevated |
| `ui:fullscreen`   | 全屏模式     | basic    |

## 贡献应用

1. Fork 本仓库
2. 在 `apps/` 目录下创建应用文件夹
3. 添加 `manifest.json`、`index.js` 和 `README.md`
4. 在 `index.json` 中添加应用条目
5. 提交 Pull Request

## 开发指南

参考 [Tapp 开发文档](../docs/development/TAPP_DEVELOPMENT.md) 了解如何开发 Tapp 应用。

## 许可证

MIT License
