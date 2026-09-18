# Myriad 安装配置生成

版本 **1.0.0**。生成新安装配置，或导入旧 `docker-compose.yml` 与 `.env`，生成保留既有数据身份的升级配置。工具只读取用户提供的文件并生成下载结果，不连接或修改服务器。

## 输出与部署目录

| 文件 | 用途 |
| --- | --- |
| `docker-compose.yml` | web、两个 worker、frontend、proxy、Guard、updater 等当前生产拓扑 |
| `.env` | 数据库连接、身份密钥、镜像版本与部署目录；不得公开 |
| `docker-guard.env` | 保存到部署目录的 `guard-policy/docker-guard.env`，供 Guard 策略使用 |
| `<domain>.conf` | Nginx / OpenResty 整站反代配置；现有证书路径须核对 |
| `Caddyfile` | 宿主 Caddy 的整站反代配置 |
| `myriad-traefik.yml` | Coolify / Dokploy 外层 Traefik 的动态路由配置 |
| `DEPLOY.md` | 所选平台的部署步骤、网络与验证说明；升级时包含保留项与注意事项 |

所有方式都需要 Docker daemon 所在主机上的**真实绝对目录**，新装默认 `/opt/myriad`。Compose、`.env` 与 `guard-policy/docker-guard.env` 必须保存在该目录。面板 UI 中导入环境变量不能替代 updater 挂载的真实 `.env` 文件。面板容器内路径也不一定是主机路径。

新装项目名为 `myriad`；升级必须使用原项目名与原部署目录。不得为了套用示例而换目录、改项目名、删除卷或初始化新数据目录。按生成的 `DEPLOY.md` 准备权限，执行 `docker compose ... config --quiet` 后再启动。

## 十种部署方式

共同原则是使用固定主机 Compose 文件，保持容器身份、数据挂载及 Guard 网络边界。以下描述的是配置路径；生成器没有实测用户服务器。

| 方式 | 配置路径 |
| --- | --- |
| 1Panel | 在真实部署目录运行编排；OpenResty 使用 host 网络时反代 `127.0.0.1:HTTP_PORT`。bridge 模式改用下述容器路径。 |
| 宝塔 | 同目录编排；宿主 Nginx 整站反代到本机发布端口，先创建站点并申请证书。 |
| aaPanel | 同目录编排；按实际 Nginx 运行位置选择宿主或容器路径。 |
| 通用 / CLI | 主机 Compose 与宿主 Nginx；核对站点证书路径后检查并加载配置。 |
| Portainer | Docker Standalone 主机项目；若接管 Stacks，保持同一项目名、物理文件和变量。不是 Swarm Stack。 |
| Dockge | stacks 目录在 Dockge 内外按相同绝对路径挂载；接管同一项目和文件，避免新建第二套栈。 |
| Coolify | 默认使用外部主机 Compose 栈；在 Servers → Proxy → Dynamic Configurations 加载生成的 Traefik 配置。不要用 Compose Empty 自动改写栈。 |
| Dokploy | 默认主机 Compose 加 Traefik File System 动态路由。若接管 Compose，Domains 保持为空、关闭 Isolated Deployments，并核对 Preview Compose 及原项目身份。 |
| Nginx Proxy Manager | NPM 加入业务网络，Proxy Host 上游填 `myriad-proxy`、端口 `80`，启用 WebSocket 与 SSL。 |
| Caddy | 宿主 Caddy 加载生成的 Caddyfile，先执行配置检查；容器安装改用容器路径。 |

**宿主反代路径：** 与 Docker 主机共享网络的反代使用 `127.0.0.1:HTTP_PORT`，默认端口 18080。

**容器反代路径：** 外层反代容器加入 Myriad 业务网络，整站上游为 `http://myriad-proxy:80`。容器自己的回环地址不能代替宿主。仅将外层代理加入业务网络，不给 Myriad 服务添加平台网络，也不将外层代理加入 admin / docker-guard 网络。一次 `docker network connect` 在容器重建后会丢失，需在外层代理配置中持久声明 external 网络，或重建后恢复并核验。

域名 A / AAAA、80/443 可达性、TLS resolver 名称和证书签发由实际部署环境决定。Coolify 默认动态路由入口为 `http` / `https`，Dokploy 为 `web` / `websecure`；实际配置不同须相应调整。所有请求应整站转发，不限于 `/api`，以保留 WebSocket、WebFinger、inbox 和联邦对象路由。

依据：[Portainer 环境文件](https://docs.portainer.io/faqs/troubleshooting/stacks-deployments-and-updates/environment-variable-management-in-docker-.env-vs.-stack.env)、[Dockge](https://github.com/louislam/dockge#how-to-install)、[Coolify Raw Compose](https://coolify.io/docs/applications/builds/docker-compose)、[Coolify 动态路由](https://coolify.io/docs/core/networking/proxy/traefik/load-balancing)、[Dokploy Compose 改写条件](https://docs.dokploy.com/docs/core/docker-compose/domains)、[Dokploy 文件路由](https://docs.dokploy.com/docs/core/domains)、[NPM 容器网络](https://nginxproxymanager.com/advanced-config/#best-practice-use-a-docker-network)。

## 数据库与网络

新装内置 PostgreSQL 使用已发布的 18，使用 `postgres:*-alpine`，数据挂载到 `/var/lib/postgresql`。新装不生成尚未发布的 19/20 稳定标签（[官方镜像标签](https://github.com/docker-library/docs/blob/master/postgres/README.md)）。按生成说明准备 pgdata 的 uid 70 与目录权限。外置模式不生成 postgres 服务、不挂载 pgdata；外置数据库的备份恢复由运维负责。

外置库有两条连接路径：

- 路由地址：三个数据库客户端都能访问的主机地址与端口。`host.docker.internal` 是否可解析取决于运行环境，不能仅凭名称假设可达。
- Docker 容器 DNS：在「附加 Docker 子网」填写数据库容器实际加入的 Docker 网络名（合法网络名，如 `1panel-network`）；生成配置会把它作为外部网络接入 backend、persona-worker 与 federation-worker。Compose 内该网络的键名固定为 `myriad-backend-ext`，实际 Docker 名称由 `MYRIAD_BACKEND_EXTRA_NETWORK` 指定。部署前请确认运行时 Guard/updater 支持该实际网络名。

| 网络 | Myriad 成员 |
| --- | --- |
| 业务网络，默认 `myriad-net` | proxy、frontend、backend、两个 worker；内置模式另含 postgres |
| 管理网络，默认 `myriad-admin-net` | backend、proxy、updater、updater-gateway |
| Guard 网络，默认 `myriad-docker-guard-net` | updater、docker-guard |
| 附加外置数据库网络（Compose 键名 `myriad-backend-ext`，实际名可自定义），按需 | 仅 backend 与两个 worker |

worker 使用独立数据库登录，不能复用管理员登录或管理员口令。内置模式由 web 预置 worker 角色。外置新装默认也由 web 预置，因此管理登录须有权执行角色创建/修改、角色参数、GRANT/REVOKE 及默认权限操作，仅能连接或执行普通迁移不够。受限托管库需 DBA 预置符合 Myriad worker 策略的独立角色，同时清空 backend 的两项 `*_DB_PASSWORD`，并将两个 worker URL 改为实际登录。升级保留原角色管理方式，不擅自启用角色修改。worker 不进入管理网络或 Guard 网络。只有 docker-guard 挂载 Docker socket；只有 proxy 发布宿主端口。

## 更新器镜像

Guard、updater、updater-gateway 共用 `UPDATER_IMAGE:UPDATER_TAG` 部署目标。三个容器使用同一镜像；修改 tag 后重建即可切换版本。`DOCKER_GUARD_IMAGE`、`UPDATER_IMAGE_REF` 是核验与恢复用的摘要记录，不覆盖部署目标。导入旧配置升级也遵循这一规则，Guard 的预期镜像跟随相同部署目标。实际版本仍由镜像内置版本报告。

## 导入旧配置升级

选择升级模式，同时提供旧 Compose 与 `.env`。导入器解析 YAML 和变量引用，识别既有数据库、密钥、项目身份、卷和网络，再生成当前拓扑。应用镜像使用所选版本，受支持的既有环境项与配置保留；新增 worker 使用独立登录。

支持边界：

- **原项目名必需。** 从旧 `.env` 的 `COMPOSE_PROJECT_NAME`、Compose `name` 或 Guard 项目配置识别；缺失时拒绝猜测。须先查明真实原项目名再补入文件。
- **内置 PostgreSQL 必须为 18 或更高版本。** 保留原数据库镜像与 pgdata 挂载，不执行 PG 大版本升级。PG 17 及以下应先另行完成备份与数据库迁移。
- 保留原数据库 URL、JWT 等身份密钥和受支持的数据卷；旧文件若只提供相对路径，生成前须明确原来的绝对部署目录。
- 未知服务、自定义数据挂载、非标准卷身份、未知字段或不受支持的命令与网络会拒绝自动升级，转为人工迁移；不会静默删掉这些配置。
- 外置旧配置未启用角色预置且缺少 worker URL 时，拒绝生成：先由 DBA 预置两个角色并提供实际 URL，避免生成不存在的登录。
- 外置数据库版本、角色权限、网络是否可达无法从两份文件证明，需要部署者验证。附加数据库网络的实际 Docker 名称会原样保留并自动接入两个 worker。
- 升级产物可能含已展开的凭据，因此 **Compose 与 `.env` 都按机密文件处理**。先备份数据库和卷，再评审生成差异和升级报告；工具不会自动应用更改。

## 镜像与密钥

业务 backend / frontend / proxy 使用版本 tag；拒绝业务 digest 输入，避免同一 digest 错用于不同镜像，或使 updater 的版本切换失效。Guard 与 updater 使用 updater 仓库解析得到的 digest 固定镜像；不接受 `latest`。

新装自动生成独立身份密钥、安装暗号与统计盐，产物经密钥与 `.env` 一致性检查。`MYRIAD_SETUP_SECRET` 用于首次创建所有者。`PROXY_ALLOW_DIRECT_UPDATER` 保持 false，backend 经 gateway 更新。YouTube / OpenXBL / PSN、出站 HTTP 代理（`PROXY_ENABLED` / `PROXY_URL` / `PROXY_BYPASS`）与 Gemini / GitHub API 镜像不在此写入，走 `/config` → 高级；宿主 `.env` 残留键会被忽略。管理台保存只双写 `BASE_URL`（改公网 origin 时同时改 `FRONTEND_URL` / `CORS_ORIGINS`）。高级资源限额与内存节约模式可按主机能力调整。

## 验证

在应用目录执行：

```sh
node scripts/security-smoke.mjs
node scripts/platform-guide-smoke.mjs
node scripts/platform-matrix.mjs
node scripts/upgrade.test.mjs
```

页面操作回归另外使用 jsdom（无需加入应用运行包）：

```sh
npm install --prefix /tmp/myriad-generator-ui-test jsdom --no-audit --no-fund
JSDOM_MODULE_PATH=/tmp/myriad-generator-ui-test/node_modules/jsdom node --test scripts/upgrade-ui.test.mjs
```

平台矩阵执行完整生成入口，覆盖十种平台 × 内置 / 外置路由 / 宿主数据库 / 外置 Docker 网络，同时验证新装和升级，调用 Docker Compose 解析产物，不连接 Docker daemon。它验证文件与安全拓扑，不代表十个平台都已在真实服务器完成部署。运行时还需验证容器健康、外置数据库登录、公网 HTTPS、WebSocket 和联邦路由。
