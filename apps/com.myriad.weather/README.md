# Weather Tapp

天气预报应用 - 演示 Tapp API 声明式调用系统。

## 功能特性

- 🌤️ 显示当前位置的实时天气
- 📊 支持摄氏/华氏温度切换
- 🔄 自动刷新天气数据
- 📱 支持多种小组件尺寸

## API 声明

本 Tapp 使用新的 API 声明系统，在 `manifest.json` 中声明所需的 API：

```json
{
  "apis": {
    "getWeather": {
      "name": "获取天气数据",
      "description": "根据用户位置获取当前天气信息",
      "access": "public",
      "type": "http",
      "url": "https://api.openweathermap.org/data/2.5/weather",
      "method": "GET",
      "params": {
        "lat": "{{geo.lat}}",
        "lon": "{{geo.lon}}",
        "appid": "{{secrets.openweather_api_key}}",
        "units": "{{params.units}}",
        "lang": "zh_cn"
      },
      "inject": ["geo", "secrets"],
      "cache_ttl": 600,
      "rate_limit": {
        "calls": 60,
        "period": 3600
      }
    }
  }
}
```

### API 声明字段说明

| 字段 | 说明 |
|------|------|
| `access` | 访问级别：`public`（公开）或 `protected`（需权限） |
| `type` | API 类型：`http`（HTTP请求）或 `builtin`（内置API） |
| `url` | HTTP 请求的目标 URL |
| `method` | HTTP 方法：GET、POST 等 |
| `params` | 请求参数，支持模板变量 |
| `inject` | 自动注入的上下文：`geo`（地理位置）、`secrets`（密钥） |
| `cache_ttl` | 缓存时间（秒） |
| `rate_limit` | 速率限制配置 |

### 模板变量

- `{{geo.lat}}` - 用户纬度
- `{{geo.lon}}` - 用户经度
- `{{geo.city}}` - 用户城市
- `{{geo.country}}` - 用户国家
- `{{secrets.xxx}}` - 后端配置的密钥
- `{{params.xxx}}` - 调用时传入的参数

## 调用方式

在 Tapp 代码中使用 `Tapp.api()` 调用声明的 API：

```javascript
// 调用 getWeather API
const response = await Tapp.api('getWeather', { 
  units: 'metric' 
});

if (response.success) {
  console.log('天气数据:', response.data);
} else {
  console.error('错误:', response.error);
}
```

## 安全性

- ✅ API 密钥由后端管理，前端无法访问
- ✅ 自动注入用户地理位置，无需 Tapp 手动获取
- ✅ 内置速率限制和缓存，防止 API 滥用
- ✅ 所有请求经过后端代理，保护用户隐私

## 权限

本 Tapp 使用 `public` 访问级别的 API，无需额外权限即可使用。
