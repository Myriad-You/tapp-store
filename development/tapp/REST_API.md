# REST API 端点

本文档列出所有可供 Tapp 调用的后端 REST API 端点。

## 概述

所有 API 请求需要包含有效的认证信息。Tapp 通过 SDK 发起请求时，系统会自动注入认证头。

### 基础 URL

```
/api
```

### 认证方式

- JWT Token（自动处理）
- Tapp ID 验证（自动处理）

---

## Tapp 管理

### 获取 Tapp 列表

```http
GET /api/tapps
```

**响应**：

```json
{
  "success": true,
  "data": [
    {
      "id": "com.example.my-tapp",
      "name": "我的 Tapp",
      "version": "1.0.0",
      "enabled": true
    }
  ]
}
```

### 获取 Tapp 详情

```http
GET /api/tapps/{id}
```

### 安装 Tapp

```http
POST /api/tapps/install
Content-Type: application/json

{
  "source": "store",
  "tappId": "com.example.tapp"
}
```

### 卸载 Tapp

```http
DELETE /api/tapps/{id}
```

### 启用/禁用 Tapp

```http
PUT /api/tapps/{id}/toggle
Content-Type: application/json

{
  "enabled": true
}
```

---

## Tapp 存储

### 获取存储值

```http
GET /api/tapp/{tappId}/storage/{key}
```

**响应**：

```json
{
  "success": true,
  "data": {
    "key": "myKey",
    "value": { "foo": "bar" },
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

### 设置存储值

```http
PUT /api/tapp/{tappId}/storage/{key}
Content-Type: application/json

{
  "value": { "foo": "bar" }
}
```

### 删除存储值

```http
DELETE /api/tapp/{tappId}/storage/{key}
```

### 获取所有存储

```http
GET /api/tapp/{tappId}/storage
```

### 清空存储

```http
DELETE /api/tapp/{tappId}/storage
```

### 存储统计

```http
GET /api/tapp/{tappId}/storage/stats
```

**响应**：

```json
{
  "success": true,
  "data": {
    "count": 42,
    "size_bytes": 1024000,
    "quota_bytes": 5242880,
    "usage_percent": 19.5
  }
}
```

---

## 平台数据

### 获取平台数据

```http
GET /api/platforms/{platform}/data
```

**参数**：

| 参数       | 类型   | 说明                                       |
| ---------- | ------ | ------------------------------------------ |
| `platform` | string | 平台标识：steam, bangumi, netease, spotify |
| `limit`    | number | 返回数量限制（默认 50）                    |
| `offset`   | number | 偏移量                                     |
| `type`     | string | 数据类型筛选                               |

**示例**：

```http
GET /api/platforms/steam/data?limit=20&type=game
```

**响应**：

```json
{
  "success": true,
  "data": [
    {
      "id": "12345",
      "name": "游戏名称",
      "type": "game",
      "platform": "steam",
      "metadata": {}
    }
  ],
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0
  }
}
```

### 获取平台统计

```http
GET /api/platforms/{platform}/stats
```

**响应**：

```json
{
  "success": true,
  "data": {
    "total": 150,
    "by_type": {
      "game": 120,
      "dlc": 30
    },
    "last_sync": "2024-01-15T10:30:00Z"
  }
}
```

### 同步平台数据

```http
POST /api/platforms/{platform}/sync
```

**权限**：需要 `platform.write` 权限

---

## AI 服务

### 聊天补全

```http
POST /api/ai/chat
Content-Type: application/json

{
  "messages": [
    { "role": "system", "content": "你是一个助手" },
    { "role": "user", "content": "你好" }
  ],
  "options": {
    "temperature": 0.7,
    "max_tokens": 1000
  }
}
```

**响应**：

```json
{
  "success": true,
  "data": {
    "content": "你好！有什么可以帮你的？",
    "usage": {
      "prompt_tokens": 20,
      "completion_tokens": 15,
      "total_tokens": 35
    }
  }
}
```

### 流式聊天

```http
POST /api/ai/chat/stream
Content-Type: application/json

{
  "messages": [...],
  "options": {...}
}
```

**响应**：Server-Sent Events (SSE)

```
data: {"content": "你", "done": false}
data: {"content": "好", "done": false}
data: {"content": "！", "done": true}
```

### 嵌入向量

```http
POST /api/ai/embeddings
Content-Type: application/json

{
  "input": "要转换的文本"
}
```

---

## 报告服务

### 获取报告

```http
GET /api/reports?type={type}&period={period}
```

**参数**：

| 参数     | 类型   | 说明                                |
| -------- | ------ | ----------------------------------- |
| `type`   | string | 报告类型：gaming, music, anime, all |
| `period` | string | 周期：week, month, year             |

**响应**：

```json
{
  "success": true,
  "data": {
    "type": "gaming",
    "period": "week",
    "start_date": "2024-01-08",
    "end_date": "2024-01-14",
    "summary": {
      "total_hours": 25.5,
      "games_played": 5
    },
    "details": [...]
  }
}
```

### 生成报告

```http
POST /api/reports/generate
Content-Type: application/json

{
  "type": "gaming",
  "period": "month"
}
```

**权限**：需要 `report.write` 权限

---

## 定时任务

### 注册定时任务

```http
POST /api/tapp/{tappId}/scheduler/tasks
Content-Type: application/json

{
  "id": "daily-sync",
  "type": "interval",
  "interval_seconds": 3600,
  "handler": "handleSync",
  "enabled": true
}
```

### 获取任务列表

```http
GET /api/tapp/{tappId}/scheduler/tasks
```

**响应**：

```json
{
  "success": true,
  "data": [
    {
      "id": "daily-sync",
      "type": "interval",
      "interval_seconds": 3600,
      "next_run": "2024-01-15T11:00:00Z",
      "last_run": "2024-01-15T10:00:00Z",
      "enabled": true
    }
  ]
}
```

### 触发任务执行

```http
POST /api/tapp/{tappId}/scheduler/tasks/{taskId}/trigger
```

### 更新任务

```http
PUT /api/tapp/{tappId}/scheduler/tasks/{taskId}
Content-Type: application/json

{
  "enabled": false
}
```

### 删除任务

```http
DELETE /api/tapp/{tappId}/scheduler/tasks/{taskId}
```

### 获取执行历史

```http
GET /api/tapp/{tappId}/scheduler/tasks/{taskId}/history
```

---

## 用户与认证

### 获取当前用户

```http
GET /api/auth/me
```

**响应**：

```json
{
  "success": true,
  "data": {
    "id": "user123",
    "username": "example",
    "role": "user",
    "preferences": {}
  }
}
```

### 获取用户角色

```http
GET /api/auth/role
```

**响应**：

```json
{
  "success": true,
  "data": {
    "role": "admin",
    "permissions": ["admin.access", "tapp.manage"]
  }
}
```

---

## Tapp 商店

### 获取商店来源

```http
GET /api/tapp-store/sources
```

**响应**：

```json
{
  "success": true,
  "data": [
    {
      "id": "official",
      "name": "官方商店",
      "url": "https://store.myriad.app",
      "enabled": true
    }
  ]
}
```

### 添加商店来源

```http
POST /api/tapp-store/sources
Content-Type: application/json

{
  "name": "自定义商店",
  "url": "https://my-store.example.com"
}
```

### 获取商店 Tapp 列表

```http
GET /api/tapp-store/tapps?source={sourceId}
```

### 获取商店 Tapp 详情

```http
GET /api/tapp-store/tapps/{tappId}?source={sourceId}
```

---

## HTTP 代理

Tapp 的 HTTP 请求通过代理服务转发：

### 代理请求

```http
POST /api/tapp/{tappId}/proxy
Content-Type: application/json

{
  "url": "https://api.example.com/data",
  "method": "GET",
  "headers": {
    "Authorization": "Bearer token"
  },
  "body": null
}
```

**响应**：

```json
{
  "success": true,
  "data": {
    "status": 200,
    "headers": {},
    "body": "..."
  }
}
```

**限制**：

- URL 必须在 `api_declarations` 中声明
- 请求频率限制：100 次/分钟

---

## 错误响应

所有 API 在错误时返回统一格式：

```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "缺少所需权限",
    "details": {
      "required": "platform.write",
      "tappId": "com.example.tapp"
    }
  }
}
```

### 常见错误码

| 错误码              | HTTP 状态码 | 说明           |
| ------------------- | ----------- | -------------- |
| `UNAUTHORIZED`      | 401         | 未认证         |
| `PERMISSION_DENIED` | 403         | 权限不足       |
| `NOT_FOUND`         | 404         | 资源不存在     |
| `RATE_LIMITED`      | 429         | 请求频率超限   |
| `QUOTA_EXCEEDED`    | 507         | 配额超限       |
| `INTERNAL_ERROR`    | 500         | 服务器内部错误 |

---

## 速率限制

| 端点类型     | 限制        |
| ------------ | ----------- |
| 存储 API     | 100 次/分钟 |
| 平台数据 API | 60 次/分钟  |
| AI API       | 20 次/分钟  |
| 代理请求     | 100 次/分钟 |
| 其他 API     | 200 次/分钟 |

超出限制时返回 429 状态码，响应头包含：

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1705312800
```
