# 地铁通

中文地铁路线与线路图查询 Tapp，包名为 top.360nenz.metro-guide。路线规划与线路图页面都可从 MetroMan 55 城市目录中选择城市，已有离线/缓存资源的城市优先排列，同一分组内保持 MetroMan 城市页的官方顺序。

规划页提供可搜索的站点选择面板：每个站点显示所属线路简称和颜色，线路索引可快速筛选站点；线路卡始终展示线路全名。北京、上海、香港和台北优先使用 MetroMan 新版规划，支持出发、到达、首班、末班时刻，IC 卡或现金付款，以及省时间、少换乘、省票价偏好；新版结果直接展示用户请求时间、车辆实际起止时间、耗时、票价、运行方向、里程和换乘步骤。其他城市使用 MetroMan 旧版结果页，同样展示用户请求时间、车辆实际起止时间、官方票价、时刻、运行方向、里程与路线详情，但不显示新版专属付款方式控件。最近一次城市、出发站和到达站会自动记忆，收藏路线也会持久保存。

## 数据说明

上海离线数据从参考 APK 的 lines.csv、stations.csv 与 patterns.csv 解析生成，包含 28 条线路路径和 423 个站点；北京保留 7 条常用线路作为精简离线基线。线路数据采用“城市 -> lines[] -> stations[]”结构，APK 本身不进入 Tapp 包。

包内保留上海线路 JSON、网页版高清 PNG 和 APP PDF，断网仍可查询；北京另有精简基线。选择城市时，应用从稳定的 MetroMan 官方换乘页下载有序线路和站点数据；仅对 MetroMan 实际支持新版的四个城市额外请求新版换乘页，因此其他城市不会先触发新版页面的 500 错误。应用同时检查对应城市高清线路图。在线数据必须通过完整结构校验才会写入私有缓存；任何失败都不会覆盖或删除离线数据，也不会上传用户输入的站点。

MetroMan 上海完整城市 ZIP 当前为 3.36 MiB，超过 Tapp 声明式 HTTP 的 2 MiB 响应上限，因此运行时不直接下载 ZIP。自我更新改用同属 MetroMan 的官方换乘页解析有序站点数据，并用 APP 官方版本清单标记版本；这条路径仍然直接来自 MetroMan，不经过第三方镜像。

重新取得 APK 城市 CSV 后，可复现生成数据：

    node apps/top.360nenz.metro-guide/scripts/extract-metroman-city.mjs <CSV解压目录>

## 本地校验与打包

在仓库根目录执行（Node.js 20+）：

    node --check apps/top.360nenz.metro-guide/main.js
    node scripts/validate-app.mjs --app top.360nenz.metro-guide --json
    npm --prefix tapp-cli test
    node tapp-cli/bin/myriad-tapp.mjs check apps/top.360nenz.metro-guide --json
    node tapp-cli/bin/myriad-tapp.mjs pack apps/top.360nenz.metro-guide --json

成功后产物位于 apps/top.360nenz.metro-guide/dist/top.360nenz.metro-guide.tapp（以 CLI 输出为准）。

## 在己方服务测试

1. 打开 https://myriad.360nenz.top/，登录后进入 Tapp 管理页。
2. 选择上传本地打包得到的 .tapp 文件，确认私有存储、通知、打开声明链接和只读网络访问权限。
3. 打开“地铁通”页面，确认已有资源城市排在选择器前面，组内顺序与 MetroMan 城市页一致；选择北京，使用快捷示例查询“西直门”到“国贸”。
4. 打开站点选择面板，确认站点显示所属线路完整名称和颜色；切换到上海，搜索“徐家汇”应显示 1、9、11 号线，点击线路索引中的“11号线”应只显示该线路站点。
5. 在北京切换出发、到达、首班、末班时刻，选择 IC 卡或现金和路线偏好；查询后检查 MetroMan 新版结果中的时刻、票价、距离、线路方向与换乘步骤。
6. 选择昆明、广州等未使用新版规划的城市，确认付款方式控件隐藏；查询后检查 MetroMan 旧版结果仍显示用户请求时间、车辆起止时间、官方票价、运行方向、里程与路线详情，不出现新版页面 500。
7. 重新打开 Tapp，确认上次选择的城市、出发站和到达站会恢复；点击收藏星标后应变为实心星号，重新打开并查询同一路线仍保持收藏。
8. 切换到“线路图”，确认该页城市选择器与路线规划同步；测试滚轮指针中心缩放至 500%、按住拖动、双击复位、缩放按钮，以及上海专属“打开 APP PDF”。
9. 点击“网页高清 PNG”确认宿主打开当前城市的 MetroMan 线路图页面；点击“更新数据”，在线成功或离线回退都应有明确提示。
10. 断网后重新打开 Tapp，确认上海路线查询与包内线路图仍可使用。

线上服务地址仅用于宿主运行与人工验收，路线计算仍在 Tapp 页面本地完成。

## 提交约定

本分支从提交 d133f6fd59c2e46c9c3cc08725d6dc7933578b4c 创建；当前包版本为 1.2.0。建议使用中文 Conventional Commit，并启用 GPG 签名：

    git add apps/top.360nenz.metro-guide index.json
    git commit -S -m "feat(tapp): 新增地铁通线路查询"

如需署名，可追加 Co-authored-by: 姓名 <邮箱> trailer。提交时 Git 可能要求输入 GPG 密码。
