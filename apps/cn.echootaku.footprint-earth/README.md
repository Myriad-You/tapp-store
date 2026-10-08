# 足迹地球

足迹地球是一个面向 Myriad 的隐私优先共享地球。它把 Owner 主动公开的居住/旅行足迹与访客匿名聚合分开保存，并以 Canvas 2D 正交投影提供可拖动、可缩放的 Page 与 Dashboard Widget。

## 数据边界

- 地点输入只能来自包内白名单：国家通常使用 ISO 3166-1 alpha-2，一级行政区通常使用 ISO 3166-2；台湾省按照中国国家行政区划口径归入中国，使用 GB/T 2260 代码 `710000`。
- 应用不请求设备定位，不接收任意经纬度、城市名或自由文本；地图点击只在内存中反投影并输出标准代码。
- Owner 足迹写入 `Tapp.shared`，只包含代码和 `resident | travel` 状态。
- 成员投稿进入专用 Federation Room 的追加式消息流；Actor、消息 ID、精确时间只取服务端信封，不进入公共共享值。
- 公共投影按不同 Actor 去重，在每个地点至少 3 人时才发布，并只显示 `3-4`、`5-9`、`10-24`、`25-49`、`50+` 计数桶。
- Guest 与 Widget 只读取 Owner 足迹和最后发布的公共投影；Widget 不读取 Room、成员或消息历史。

## 治理与容量

- 每个 Actor 每批次最多 8 个不同地点，相邻有效投稿至少间隔 60 秒。
- 只有服务端 Room owner Actor 的授权事件能增删审核员；Owner/有效审核员可隐藏、恢复、封禁、解封和处理举报。
- 历史最多读取 20 页、每页 100 条。达到上限或任一页失败时标记为不完整，并禁止重新发布公共投影。
- Room 是原始追加日志，客户端无法阻止篡改客户端直接写入无效原始消息；严格重放会拒绝这些消息，避免其进入有效足迹和公共投影，但它们仍可能占用 Room 容量。如需在入口处拒绝，必须由 Myriad 宿主新增服务端 schema 策略。

## 地图来源

地图来自 [Natural Earth Vector](https://github.com/nvkelso/natural-earth-vector)，固定源码提交 `ca96624a56bd078437bca8184e78163e5039ad19`。Natural Earth 数据为 public domain。

- `ne_110m_admin_0_countries.geojson` 原始 SHA-256：`D2AEC98BFD1FFDA2D8ADEA42B7EC473365EEF38DEFC48E83AFB7D58AE60BFE7C`
- `ne_50m_admin_1_states_provinces.geojson` 原始 SHA-256：`531F548564059FDC13245A36C474E672B9E52C56310B19037A902554673F7E08`
- 生成的 `assets/world-110m.json` SHA-256：`4AB239930EAAF82ED176A3031DE3691755AB7168EB2EF9C70C9231442BAAABBA`
- 生成的 `assets/admin1-50m.json` SHA-256：`5AEBF0FFC180EAF69B6C90CE4C77425AE40268A9043E00DC7F8768560DECF396`

使用 `scripts/build-map-data.mjs` 可从固定原始文件重建资产。生成器进行几何简化、0.1° 量化并只保留标准代码、有限多语言名称、多边形和固定代表点；不保留城市、道路、人口或原始数据库字段。源数据中的 `TW` 仅作为几何导入别名：生成后从顶级国家列表移除，其多边形并入中国，并生成 `中国 → 台湾省（710000）` 的一级行政区记录。

该固定版本的 50m 数据有 290 个一级行政区填有可验证的 ISO 3166-2；应用另按 GB/T 2260 生成台湾省记录，因此最终资产包含 291 个一级行政区。应用不会用 `postal`、`adm1_code` 等非标准字段补齐空缺。

## 本地检查

```powershell
& 'D:\SDK\NodeJS\node-versions\v24.16.0\installation\node.exe' --test tests/*.test.mjs
& 'D:\SDK\NodeJS\node-versions\v24.16.0\installation\node.exe' scripts/self-check.mjs
```
