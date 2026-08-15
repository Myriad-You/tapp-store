// Myriad Config Generator — 生产 compose / .env / Nginx
//
// 面板差异（用户可选）：
// - 1Panel：编排粘贴 YAML + 环境变量框粘贴 .env；站点路径 /www/sites/<domain>/...
// - 宝塔：可「创建编排」粘贴 YAML，也可目录内 compose+env；站点 /www/wwwroot、日志 /www/wwwlogs
//   （官方教程 thread-140412；.env 端口变量见 thread-141215）
// - 通用/CLI：标准 Linux 路径，docker compose 命令行部署

/** @typedef {'1panel'|'baota'|'generic'} PanelId */

/**
 * 各面板的路径与部署文案。Nginx 默认模板与 DEPLOY 说明由此生成。
 * @type {Record<PanelId, object>}
 */
var PANEL_PROFILES = {
  '1panel': {
    id: '1panel',
    label: '1Panel',
    siteRoot: function (d) { return '/www/sites/' + d + '/index'; },
    accessLog: function (d) { return '/www/sites/' + d + '/log/access.log main'; },
    errorLog: function (d) { return '/www/sites/' + d + '/log/error.log'; },
    acmeRoot: function (d) { return '/www/sites/' + d + '/index'; },
    acmeComment: 'ACME (1Panel/certbot): local root BEFORE catch-all. Other /.well-known/* via proxy.',
    envBadge: '1Panel 环境变量框 · 勿公开',
    envCopyLabel: '复制到 1Panel',
    composeBadge: '1Panel 编排 · 粘贴 YAML',
    resultsIntro: '1Panel：docker-compose.yml →「容器 / 编排」；.env →「环境变量」。站点整站反代到 HTTP_BIND:HTTP_PORT。',
    successNotify: '生成成功：1Panel 将 YAML 粘到「编排」，.env 粘到「环境变量」',
    // Baota-specific include patterns not used; 1Panel proxy includes stripped in transform
    proxyIncludeRe: /^[ \t]*include\s+[^;\n]*\/proxy\/\*\.conf\s*;[ \t]*$/gm
  },
  baota: {
    id: 'baota',
    label: '宝塔面板',
    siteRoot: function (d) { return '/www/wwwroot/' + d; },
    accessLog: function (d) { return '/www/wwwlogs/' + d + '.log'; },
    errorLog: function (d) { return '/www/wwwlogs/' + d + '.error.log'; },
    acmeRoot: function (d) { return '/www/wwwroot/' + d; },
    acmeComment: 'ACME (宝塔 SSL / certbot): webroot 在站点根 BEFORE catch-all. Other /.well-known/* via proxy.',
    envBadge: '与 compose 同目录 · .env 文件',
    envCopyLabel: '复制 .env',
    composeBadge: '粘贴 YAML 或目录部署',
    resultsIntro: '宝塔：可「创建编排」粘贴 YAML，或目录内放 compose+.env；内置库务必 chown 70:70 pgdata（见部署说明）。',
    successNotify: '生成成功：宝塔可粘贴编排或目录部署；内置 Postgres 请先 chown 70:70 pgdata',
    // 宝塔反向代理 / 扩展 include
    proxyIncludeRe: /^[ \t]*include\s+[^;\n]*(?:\/proxy\/|\/extension\/)[^;\n]*\*\.conf\s*;[ \t]*$/gm
  },
  generic: {
    id: 'generic',
    label: '通用 / CLI',
    siteRoot: function (d) { return '/var/www/' + d + '/html'; },
    accessLog: function (d) { return '/var/log/nginx/' + d + '.access.log'; },
    errorLog: function (d) { return '/var/log/nginx/' + d + '.error.log'; },
    acmeRoot: function (d) { return '/var/www/' + d + '/html'; },
    acmeComment: 'ACME (certbot webroot): local root BEFORE catch-all. Other /.well-known/* via proxy.',
    envBadge: 'compose 同目录 · .env 文件',
    envCopyLabel: '复制 .env',
    composeBadge: 'docker compose · CLI',
    resultsIntro: '通用部署：同目录放置 docker-compose.yml 与 .env，执行 docker compose up -d；外层 Nginx/Caddy 整站反代。',
    successNotify: '生成成功：请将文件放到同一目录后执行 docker compose up -d',
    proxyIncludeRe: /^[ \t]*include\s+[^;\n]*\/proxy\/\*\.conf\s*;[ \t]*$/gm
  }
};

function getPanelProfile(panelId) {
  return PANEL_PROFILES[panelId] || PANEL_PROFILES['1panel'];
}

/**
 * Bundled Postgres bind-mount 权限说明（与面板无关，宝塔文件管理创建目录时最易踩）。
 * 依据：官方 postgres 镜像 initdb 要求数据目录对容器内 postgres 系统用户可写；
 * postgres:*-alpine 的系统用户为 uid/gid 70（非 POSTGRES_USER 业务名）。
 */
function buildPgdataPermissionSection(isExternal) {
  if (isExternal) {
    return [
      '## 数据库权限（外置模式）',
      '',
      '`MYRIAD_DB_MODE=external` 时 compose **不含** postgres，不创建 `./pgdata`。',
      '权限问题请查外置库本身的用户/网络；backend 的 `DATABASE_URL` 须指向可达主机。'
    ].join('\n');
  }
  return [
    '## 数据库目录权限（bundled · 必读）',
    '',
    'Myriad 使用 **bind mount** `./pgdata:/var/lib/postgresql`（PG18+ 官方镜像要求挂到',
    '`/var/lib/postgresql` 而非旧版的 `/var/lib/postgresql/data`）。',
    '',
    '官方 `postgres:*-alpine` 容器内系统用户为 **uid 70 / gid 70**。',
    '若在面板「文件」里用 root 创建了 `pgdata`，常见报错：',
    '',
    '- `Permission denied` / `could not change permissions of directory`',
    '- `initdb: error: ... data directory ... has wrong ownership`',
    '- 容器反复重启、`pg_isready` 永不 healthy',
    '',
    '**首次启动前**在 compose 项目目录执行（宿主机）：',
    '',
    '```bash',
    'mkdir -p pgdata state backups',
    '# alpine 镜像：postgres 系统用户 = 70',
    'chown -R 70:70 pgdata',
    'chmod 700 pgdata',
    'chmod 600 .env',
    '```',
    '',
    '宝塔：可用 SSH 或「终端」执行；文件管理新建的文件夹默认常为 root 属主，**必须 chown**。',
    '不要把 `pgdata` 做成 Docker named volume（updater 快照依赖宿主目录 bind）。',
    '',
    '若已经用错误权限 init 失败：先 `docker compose down`，备份后清空空的 `pgdata`，',
    '再 `chown 70:70` 后重新 `up`（有数据时先备份再动）。'
  ].join('\n');
}

function buildPanelDeploySection(panelId, mainDomain, httpBind, httpPort, isExternal) {
  var bind = httpBind + ':' + httpPort;
  var pgSection = buildPgdataPermissionSection(isExternal);
  if (panelId === 'baota') {
    return [
      '## 宝塔面板',
      '',
      '### 依据（公开案例 / 官方帖，请对照你的面板版本）',
      '',
      '- **站点路径**：宝塔 Nginx 站点 conf 默认 `root /www/wwwroot/<域名>`、',
      '  `access_log /www/wwwlogs/<域名>.log`（论坛站点 conf 示例普遍如此）。',
      '- **Compose 两种用法**（宝塔开发教程 [thread-140412](https://www.bt.cn/bbs/thread-140412-1-1.html)）：',
      '  1) **容器编排 → 创建编排**：直接粘贴 `docker-compose.yml` 内容；',
      '  2) 或在服务器上放好 yml 后终端 `docker compose up -d`，再在面板里管理。',
      '- **.env**：应用商店类编排常在面板里改 `.env` 端口变量',
      '  （[thread-141215](https://www.bt.cn/bbs/thread-141215-1-1.html)：`HOST_IP=127.0.0.1` 仅本机、`0.0.0.0` 对外）。',
      '  社区亦有「模板/路径不对导致 .env 未加载」案例（thread-124845）；',
      '  若变量未生效，可把关键项写进 yml 的 `environment`，或确认 `.env` 与 compose 同目录。',
      '- **数据库权限**：全球 Docker+Postgres bind mount 通病（wrong ownership / Permission denied），',
      '  非宝塔独有；宝塔「文件」用 root 建目录时更容易踩。见下方专节（alpine **uid 70** 已实测）。',
      '',
      '### 推荐步骤',
      '',
      '**方式 A — 粘贴编排（接近 1Panel）**',
      '1. Docker → 容器编排 → 创建编排，粘贴生成的 `docker-compose.yml`',
      '2. 将 `.env` 放到编排工作目录（或按面板提示编辑 env）；`chmod 600 .env`',
      '3. 内置库：先按下方「数据库目录权限」准备 `pgdata`，再启动',
      '',
      '**方式 B — 目录 + 终端**',
      '1. 任意目录写入 `docker-compose.yml` + `.env`（路径自定）',
      '2. 处理 `pgdata` 权限后：`docker compose pull && docker compose up -d`',
      '3. 在宝塔容器编排页管理该项目',
      '',
      '**网站反代**',
      '1. 网站 → 添加站点（域名 `' + mainDomain + '`）',
      '2. 反向代理目标 `http://127.0.0.1:' + httpPort + '`，代理目录 **`/`（整站）**，勿只代理 `/api`',
      '3. 开启 WebSocket；SSL 用宝塔申请时保留 SSL 段，ACME webroot 与站点根一致',
      '4. 或覆盖站点 conf 为生成的 Nginx（路径默认 `/www/wwwroot` + `/www/wwwlogs`）',
      '',
      'Myriad proxy 监听：`' + bind + '`（反代到本机时 `HTTP_BIND_ADDRESS=127.0.0.1` 即可）',
      '',
      pgSection
    ].join('\n');
  }
  if (panelId === 'generic') {
    return [
      '## 通用 / CLI',
      '',
      '```bash',
      'mkdir -p /opt/myriad && cd /opt/myriad',
      '# 放入 docker-compose.yml 与 .env',
      isExternal
        ? 'mkdir -p state backups && chmod 600 .env'
        : 'mkdir -p pgdata state backups && chown -R 70:70 pgdata && chmod 700 pgdata && chmod 600 .env',
      'docker compose pull && docker compose up -d',
      '```',
      '',
      '外层 Nginx/Caddy 整站反代到 `' + bind + '`（见生成的站点 conf）。',
      '',
      pgSection
    ].join('\n');
  }
  // 1panel default
  return [
    '## 1Panel',
    '',
    '1. **容器 → 编排 → 创建**：粘贴 `docker-compose.yml`',
    '2. **环境变量**：粘贴 `.env` 全文（勿公开、勿提交）',
    '3. 若为内置 Postgres：在编排工作目录准备 `pgdata` 并修正属主（见下方权限专节），再启动',
    '4. **网站** 创建反向代理或导入生成的 Nginx 配置，目标 `http://' + bind + '`，必须 **整站** 反代',
    '5. 申请 SSL 后确认 `/.well-known/acme-challenge/` 仍为本地目录，其余 `.well-known` 走 proxy',
    '',
    '站点路径约定（1Panel 默认）：`/www/sites/' + mainDomain + '/…`',
    '',
    pgSection
  ].join('\n');
}

// Bundled Postgres service (MYRIAD_DB_MODE=bundled). Omitted entirely for external mode.
var POSTGRES_SERVICE_TEMPLATE = `  postgres:
    image: postgres:{{DB_VERSION}}-alpine
    container_name: myriad-postgres
    deploy:
      resources:
        limits:
          cpus: '{{DB_CPU_LIMIT}}'
          memory: {{DB_MEM_LIMIT}}
        reservations:
          cpus: '0.5'
          memory: 512M
    environment:
      POSTGRES_DB: \${POSTGRES_DB}
      POSTGRES_USER: \${POSTGRES_USER}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      POSTGRES_INITDB_ARGS: "-E UTF8 --locale=C --lc-collate=C --lc-ctype=C"
      POSTGRES_SHARED_BUFFERS: 512MB
      POSTGRES_EFFECTIVE_CACHE_SIZE: 1536MB
      POSTGRES_MAINTENANCE_WORK_MEM: 128MB
      POSTGRES_CHECKPOINT_COMPLETION_TARGET: 0.9
      POSTGRES_WAL_BUFFERS: 16MB
      POSTGRES_DEFAULT_STATISTICS_TARGET: 100
      POSTGRES_RANDOM_PAGE_COST: 1.1
      POSTGRES_EFFECTIVE_IO_CONCURRENCY: 200
      POSTGRES_WORK_MEM: 4MB
      POSTGRES_MIN_WAL_SIZE: 1GB
      POSTGRES_MAX_WAL_SIZE: 4GB
      POSTGRES_MAX_WORKER_PROCESSES: 4
      POSTGRES_MAX_PARALLEL_WORKERS_PER_GATHER: 2
      POSTGRES_MAX_PARALLEL_WORKERS: 4
      POSTGRES_MAX_PARALLEL_MAINTENANCE_WORKERS: 2
      TZ: Asia/Shanghai
    volumes:
      # bind only（updater 快照）；勿改 volume
      - ./pgdata:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER} -d \${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    networks: [myriad-net]
    restart: unless-stopped
    security_opt: [no-new-privileges:true]
    read_only: false
    tmpfs: [/tmp, /run]
    logging:
      driver: "json-file"
      options: { max-size: "10m", max-file: "3" }

`;

var DOCKER_COMPOSE_TEMPLATE = `# Myriad
# nets: myriad-net | myriad-admin-net | myriad-docker-guard-net(internal)
# MYRIAD_DB_MODE={{MYRIAD_DB_MODE}}
# {{COMPOSE_START_HINT}}

services:
{{POSTGRES_SERVICE}}  backend-volume-init:
    image: \${BACKEND_IMAGE:-docker.io/somekawahitomi/myriad-backend}:\${MYRIAD_TAG}
    container_name: myriad-backend-volume-init
    user: "0:0"
    environment:
      MYRIAD_VOLUME_INIT_ONLY: "true"
    volumes:
      - backend_cache:/app/cache
      - backend_data:/app/data
    network_mode: none
    restart: "no"
    security_opt: [no-new-privileges:true]
    read_only: true
    tmpfs: [/tmp]

  backend:
    image: \${BACKEND_IMAGE:-docker.io/somekawahitomi/myriad-backend}:\${MYRIAD_TAG}
    container_name: myriad-backend
    deploy:
      resources:
        limits:
          cpus: '{{BACKEND_CPU_LIMIT}}'
          memory: {{BACKEND_MEM_LIMIT}}
        reservations:
          cpus: '0.5'
          memory: 512M
    environment:
      DATABASE_URL: \${DATABASE_URL}
      SERVER_HOST: 0.0.0.0
      SERVER_PORT: 1103
      DATA_DIR: /app/data
      CACHE_DIR: /app/cache
      JWT_SECRET: \${JWT_SECRET}
      MYRIAD_SETUP_SECRET: \${MYRIAD_SETUP_SECRET}
      TRUST_PROXY_HEADERS: "true"
      CORS_ORIGINS: \${CORS_ORIGINS:-http://localhost}
      CSP_CONNECT_SRC: \${CSP_CONNECT_SRC:-'self' https:}
      ENVIRONMENT: \${ENVIRONMENT:-production}
      FRONTEND_URL: \${FRONTEND_URL:-}
      BASE_URL: \${BASE_URL:-}
      RUST_LOG: \${RUST_LOG:-info}
      TZ: Asia/Shanghai
      MYRIAD_VERSION: \${MYRIAD_TAG}
      MYRIAD_UPDATER_URL: http://updater-gateway:1104
      UPDATER_GATEWAY_SECRET: \${UPDATER_GATEWAY_SECRET}
    depends_on:
{{BACKEND_DEPENDS_ON}}
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:1103/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    volumes:
      - backend_cache:/app/cache
      - backend_data:/app/data
    networks: [myriad-net, myriad-admin-net{{BACKEND_EXTRA_NETWORK_REF}}]
    restart: unless-stopped
    security_opt: [no-new-privileges:true]
    read_only: false
    tmpfs: [/tmp]
    # uid 1000；backend-volume-init 会先修复 volume 写权限
    logging:
      driver: "json-file"
      options: { max-size: "10m", max-file: "3" }

  frontend:
    image: \${FRONTEND_IMAGE:-docker.io/somekawahitomi/myriad-frontend}:\${MYRIAD_TAG}
    container_name: myriad-frontend
    deploy:
      resources:
        limits:
          cpus: '{{FRONTEND_CPU_LIMIT}}'
          memory: {{FRONTEND_MEM_LIMIT}}
        reservations:
          cpus: '0.25'
          memory: 256M
    environment:
      PUBLIC_API_URL: \${PUBLIC_API_URL:-}
      NODE_ENV: production
      TZ: Asia/Shanghai
      MYRIAD_VERSION: \${MYRIAD_TAG}
    depends_on:
      backend: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:1102"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    networks: [myriad-net]
    restart: unless-stopped
    security_opt: [no-new-privileges:true]
    read_only: true
    tmpfs: [/tmp]
    logging:
      driver: "json-file"
      options: { max-size: "10m", max-file: "3" }

  # proxy: only public host port. Routes SPA, /api, health, and federation public paths
  # (/.well-known/webfinger|nodeinfo, /nodeinfo/2.1, /inbox, /users/*). Outer TLS
  # must whole-site reverse-proxy here — not /api-only. Preserve public Host for
  # ActivityPub HTTP Signatures. Bind stays HTTP_BIND_ADDRESS:HTTP_PORT (1Panel-friendly).
  proxy:
    image: \${PROXY_IMAGE:-docker.io/somekawahitomi/myriad-proxy}:\${PROXY_TAG}
    container_name: myriad-proxy
    ports:
      - "\${HTTP_BIND_ADDRESS:-127.0.0.1}:\${HTTP_PORT:-8080}:80"
    environment:
      PROXY_STATE_FILE: /state/maintenance.json
      PROXY_BACKEND_UPSTREAM: http://backend:1103
      PROXY_FRONTEND_UPSTREAM: http://frontend:1102
      PROXY_UPDATER_UPSTREAM: http://updater:1101
      PROXY_TRUSTED_UPSTREAMS: \${PROXY_TRUSTED_UPSTREAMS:-}
      PROXY_ALLOW_DIRECT_UPDATER: \${PROXY_ALLOW_DIRECT_UPDATER:-false}
      MYRIAD_VERSION: \${PROXY_TAG}
      TZ: Asia/Shanghai
    volumes:
      - ./state:/state:ro
    networks: [myriad-net, myriad-admin-net]
    restart: unless-stopped
    security_opt: [no-new-privileges:true]
    read_only: true
    tmpfs: [/tmp]
    logging:
      driver: "json-file"
      options: { max-size: "10m", max-file: "3" }

  docker-guard:
    # 仅此处挂 docker.sock
    image: \${UPDATER_IMAGE:-docker.io/somekawahitomi/myriad-updater}:\${UPDATER_TAG}
    container_name: myriad-docker-guard
    entrypoint: ["/usr/bin/tini", "--", "/usr/local/bin/myriad-docker-guard"]
    environment:
      UPDATE_TOKEN: \${UPDATE_TOKEN}
      COMPOSE_PROJECT_NAME: \${COMPOSE_PROJECT_NAME:-myriad}
      MYRIAD_DOCKER_NETWORK: \${MYRIAD_DOCKER_NETWORK:-myriad-net}
      MYRIAD_ADMIN_NETWORK: \${MYRIAD_ADMIN_NETWORK:-myriad-admin-net}
      MYRIAD_DOCKER_GUARD_NETWORK: \${MYRIAD_DOCKER_GUARD_NETWORK:-myriad-docker-guard-net}
      DOCKER_GUARD_COMPOSE_DIR: /host/compose
      DOCKER_GUARD_ENV_FILE: /host/compose/.env
      DOCKER_GUARD_ALLOWED_IMAGES: \${BACKEND_IMAGE:-docker.io/somekawahitomi/myriad-backend},\${FRONTEND_IMAGE:-docker.io/somekawahitomi/myriad-frontend},\${PROXY_IMAGE:-docker.io/somekawahitomi/myriad-proxy},\${UPDATER_IMAGE:-docker.io/somekawahitomi/myriad-updater}{{DOCKER_GUARD_EXTRA_IMAGES}}
      RUST_LOG: \${DOCKER_GUARD_LOG:-info}
      TZ: Asia/Shanghai
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./:/host/compose:ro
    networks: [myriad-docker-guard-net]
    restart: unless-stopped
    security_opt: [no-new-privileges:true]
    read_only: true
    tmpfs: [/tmp, /run]
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:2375/_ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    logging:
      driver: "json-file"
      options: { max-size: "10m", max-file: "3" }

  updater:
    image: \${UPDATER_IMAGE:-docker.io/somekawahitomi/myriad-updater}:\${UPDATER_TAG}
    container_name: myriad-updater
    environment:
      UPDATE_TOKEN: \${UPDATE_TOKEN}
      CHANNEL: \${CHANNEL:-stable}
      GITHUB_TOKEN: \${GITHUB_TOKEN:-}
      REGISTRY_MIRROR: \${REGISTRY_MIRROR:-}
      MYRIAD_GITHUB_REPO: \${MYRIAD_GITHUB_REPO:-Myriad-You/Myriad}
      CHECK_INTERVAL_SECS: \${CHECK_INTERVAL_SECS:-3600}
      UPDATER_STATE_DIR: /host/compose/state
      UPDATER_ENV_FILE: /host/compose/.env
{{UPDATER_PGDATA_LINE}}      UPDATER_COMPOSE_DIR: /host/compose
      DOCKER_HOST: tcp://docker-guard:2375
      DOCKER_GUARD_SELF_UPDATE_URL: http://docker-guard:2375/_myriad/self-update
      COSIGN_VERIFY: \${COSIGN_VERIFY:-strict}
      UPDATER_ALLOW_INSECURE_COSIGN: \${UPDATER_ALLOW_INSECURE_COSIGN:-}
      COSIGN_INSECURE_OK: \${COSIGN_INSECURE_OK:-}
      COMPOSE_PROJECT_NAME: \${COMPOSE_PROJECT_NAME:-myriad}
      MYRIAD_DOCKER_NETWORK: \${MYRIAD_DOCKER_NETWORK:-myriad-net}
      MYRIAD_VERSION: \${UPDATER_TAG}
      TZ: Asia/Shanghai
    volumes:
      - ./:/host/compose
    networks: [myriad-admin-net, myriad-docker-guard-net]
    depends_on:
      docker-guard: { condition: service_healthy }
    restart: unless-stopped
    security_opt: [no-new-privileges:true]
    logging:
      driver: "json-file"
      options: { max-size: "10m", max-file: "3" }

  updater-gateway:
    image: \${UPDATER_IMAGE:-docker.io/somekawahitomi/myriad-updater}:\${UPDATER_TAG}
    container_name: myriad-updater-gateway
    entrypoint: ["/usr/bin/tini", "--", "/usr/local/bin/myriad-updater-gateway"]
    environment:
      UPDATE_TOKEN: \${UPDATE_TOKEN}
      UPDATER_GATEWAY_SECRET: \${UPDATER_GATEWAY_SECRET}
      UPDATER_UPSTREAM: http://updater:1101
      GATEWAY_LISTEN: 0.0.0.0:1104
      TZ: Asia/Shanghai
    networks: [myriad-admin-net]
    depends_on:
      - updater
    restart: unless-stopped
    security_opt: [no-new-privileges:true]
    read_only: true
    tmpfs: [/tmp, /run]
    logging:
      driver: "json-file"
      options: { max-size: "10m", max-file: "3" }

volumes:
  backend_cache: { driver: local }
  backend_data: { driver: local }

networks:
  myriad-net:
    name: \${MYRIAD_DOCKER_NETWORK:-myriad-net}
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
  myriad-admin-net:
    name: \${MYRIAD_ADMIN_NETWORK:-myriad-admin-net}
    driver: bridge
  myriad-docker-guard-net:
    name: \${MYRIAD_DOCKER_GUARD_NETWORK:-myriad-docker-guard-net}
    driver: bridge
    internal: true
{{EXTRA_NETWORK_DECL}}`;

var ENV_TEMPLATE = `# Myriad .env — chmod 600，勿提交 Git
# 禁止 :latest

MYRIAD_TAG={{MYRIAD_TAG}}
# PROXY_TAG is separate from MYRIAD_TAG — bump when proxy gains AP routing / federation fixes
PROXY_TAG={{PROXY_TAG}}
UPDATER_TAG={{UPDATER_TAG}}
BACKEND_IMAGE=docker.io/somekawahitomi/myriad-backend
FRONTEND_IMAGE=docker.io/somekawahitomi/myriad-frontend
# PROXY_IMAGE=docker.io/somekawahitomi/myriad-proxy
# UPDATER_IMAGE=docker.io/somekawahitomi/myriad-updater
COMPOSE_PROJECT_NAME=myriad
MYRIAD_DOCKER_NETWORK={{MYRIAD_DOCKER_NETWORK}}
MYRIAD_ADMIN_NETWORK={{MYRIAD_ADMIN_NETWORK}}
MYRIAD_DOCKER_GUARD_NETWORK={{MYRIAD_DOCKER_GUARD_NETWORK}}
{{BACKEND_EXTRA_NETWORK_LINE}}

UPDATE_TOKEN={{UPDATE_TOKEN}}
UPDATER_GATEWAY_SECRET={{UPDATER_GATEWAY_SECRET}}

CHANNEL={{CHANNEL}}
UPDATE_MODE=release
# GITHUB_TOKEN=
# REGISTRY_MIRROR=
MYRIAD_GITHUB_REPO=Myriad-You/Myriad
CHECK_INTERVAL_SECS=3600

HTTP_BIND_ADDRESS={{HTTP_BIND_ADDRESS}}
HTTP_PORT={{HTTP_PORT}}
# PROXY_TRUSTED_UPSTREAMS: empty trusts private/loopback peers only (outer panel/Nginx).
# Never set 0.0.0.0/0 (would trust forged X-Forwarded-* from anyone).
# PROXY_TRUSTED_UPSTREAMS=
PROXY_ALLOW_DIRECT_UPDATER=false

COSIGN_VERIFY={{COSIGN_VERIFY}}
{{COSIGN_INSECURE_HINT}}

# MYRIAD_DB_MODE=bundled|external — external: no compose postgres; updater skips pgdata snapshots
MYRIAD_DB_MODE={{MYRIAD_DB_MODE}}
{{POSTGRES_ENV_BLOCK}}DATABASE_URL={{DATABASE_URL}}
JWT_SECRET={{JWT_SECRET}}
# First-owner claim passphrase. Required by /api/setup/create-admin.
MYRIAD_SETUP_SECRET={{MYRIAD_SETUP_SECRET}}

CORS_ORIGINS={{CORS_ORIGINS}}
# BASE_URL / FRONTEND_URL = public HTTPS origin (required for federation Actor URLs)
BASE_URL=https://{{MAIN_DOMAIN}}
FRONTEND_URL=https://{{MAIN_DOMAIN}}
PUBLIC_API_URL=
# RUST_LOG=info
`;

// Whole-site reverse proxy to Myriad proxy (NOT /api-only). Federation paths that
// MUST reach proxy: /.well-known/webfinger, /.well-known/nodeinfo, /nodeinfo/2.1,
// /inbox, /users/, plus /api/* (federation WS under /api/federation/*/ws).
var DEFAULT_NGINX_TEMPLATE = `server {
    listen 80;
    server_name {{MAIN_DOMAIN}};

    index index.php index.html index.htm default.php default.htm default.html;
    access_log {{ACCESS_LOG}};
    error_log {{ERROR_LOG}};

    # {{ACME_COMMENT}}
    location ^~ /.well-known/acme-challenge/ {
        root {{ACME_ROOT}};
        allow all;
    }

    # Whole-site → Myriad proxy (SPA + /api + federation). Do NOT proxy only /api.
    # Must reach proxy: /.well-known/webfinger, /.well-known/nodeinfo, /nodeinfo/2.1,
    # /inbox, /users/, /api/* (incl. WS /api/federation/*/ws). Preserve Host for HTTP Signatures.
    location / {
        proxy_pass http://127.0.0.1:{{HTTP_PORT}};

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;

        proxy_buffering off;
        client_max_body_size 50M;
    }

    location = /healthz {
        proxy_pass http://127.0.0.1:{{HTTP_PORT}}/healthz;
        access_log off;
    }

    # Block dangerous extensions under .well-known; do NOT block webfinger/nodeinfo.
    if ( $uri ~ "^/\\.well-known/.*\\.(php|jsp|py|js|css|lua|ts|go|zip|tar\\.gz|rar|7z|sql|bak)$" ) {
        return 403;
    }
    root {{SITE_ROOT}};
    error_page 404 /404.html;
}
`;

var DEFAULT_EXTRA_NGINX_TEMPLATE = `server {
    listen 80;
    server_name {{EXTRA_DOMAIN}};

    index index.php index.html index.htm default.php default.htm default.html;
    access_log {{EXTRA_ACCESS_LOG}};
    error_log {{EXTRA_ERROR_LOG}};

    # {{ACME_COMMENT}}
    location ^~ /.well-known/acme-challenge/ {
        root {{EXTRA_ACME_ROOT}};
        allow all;
    }

    # Whole-site → Myriad proxy (SPA + /api + federation). Do NOT proxy only /api.
    # Must reach proxy: /.well-known/webfinger, /.well-known/nodeinfo, /nodeinfo/2.1,
    # /inbox, /users/, /api/* (incl. WS /api/federation/*/ws). Preserve Host for HTTP Signatures.
    location / {
        proxy_pass http://127.0.0.1:{{HTTP_PORT}};

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;

        proxy_buffering off;
        client_max_body_size 50M;
    }

    # Block dangerous extensions under .well-known; do NOT block webfinger/nodeinfo.
    if ( $uri ~ "^/\\.well-known/.*\\.(php|jsp|py|js|css|lua|ts|go|zip|tar\\.gz|rar|7z|sql|bak)$" ) {
        return 403;
    }
    root {{EXTRA_SITE_ROOT}};
    error_page 404 /404.html;
}
`;

// 部署说明（生成结果中的文本卡片）；{{PANEL_DEPLOY_SECTION}} 按面板填充
var DEPLOY_NOTES_TEMPLATE = `# Myriad 部署

同目录：\`docker-compose.yml\` + \`.env\`（\`chmod 600\`，勿提交）。

面板适配：\`{{PANEL_LABEL}}\` · 数据库模式：\`MYRIAD_DB_MODE={{MYRIAD_DB_MODE}}\`（bundled=内置 Postgres；external=外置）。

## 网络

| 网络 | 成员 |
|------|------|
| myriad-net | {{DEPLOY_NET_MEMBERS}} |
| myriad-admin-net | backend, updater, updater-gateway, proxy |
| myriad-docker-guard-net (internal) | updater, docker-guard |

\`backend-volume-init\` 使用 \`network_mode: none\`；仅 proxy 开宿主端口。

## 联邦 / Federation

- \`BASE_URL\` / \`FRONTEND_URL\` = 公网 HTTPS 源站（如 \`https://{{MAIN_DOMAIN}}\`），用于 Actor URL；联邦必填。
- 外层 Nginx/Caddy 必须 **整站** 反代到 Myriad proxy（\`HTTP_BIND_ADDRESS:HTTP_PORT\`），**不要只反代 /api**。
- 以下路径必须到达 proxy（再由 proxy 转 backend）：
  - \`/.well-known/webfinger\`
  - \`/.well-known/nodeinfo\`
  - \`/nodeinfo/2.1\`
  - \`/inbox\`
  - \`/users/\`
  - \`/api/*\`（含联邦 WebSocket \`/api/federation/*/ws\`）
- ACME：\`/.well-known/acme-challenge/\` 由外层 Nginx 本地提供；其余 \`.well-known\` 仍走 proxy。
- 冒烟（期望 JSON，不是 HTML）：

\`\`\`bash
curl -sS "https://{{MAIN_DOMAIN}}/.well-known/webfinger?resource=acct:USER@{{MAIN_DOMAIN}}" | head -c 200
curl -sS "https://{{MAIN_DOMAIN}}/.well-known/nodeinfo" | head -c 200
\`\`\`

{{PANEL_DEPLOY_SECTION}}

## 启动（命令行等价）

\`\`\`bash
{{DEPLOY_MKDIR}}
chmod 600 .env
docker compose pull && docker compose up -d
\`\`\`

\`backend-volume-init\` 会在 backend 启动前修复持久卷权限；无需手工 chown。

首次打开站点会进入安装向导。创建所有者时必须填写 **安装暗号**（\`.env\` 里的 \`MYRIAD_SETUP_SECRET\`）。能读到这份配置的人才能当站长。

可选：\`scripts/docker/deploy.sh up\`（含环境初始化与部署检查）。

## HTTPS

https://{{MAIN_DOMAIN}} → \`{{HTTP_BIND_ADDRESS}}:{{HTTP_PORT}}\`（整站反代）

## 更新

设置 → 关于 → 更新管理 · \`{{CHANNEL}}\` · cosign \`{{COSIGN_VERIFY}}\`

proxy 有 AP 路由变更时需单独 bump \`PROXY_TAG\`（与 \`MYRIAD_TAG\` 独立）。

\`DOCKER_GUARD_ALLOWED_IMAGES\` 必须包含 proxy（默认 \`myriad-proxy\`）；否则 product/proxy 更新会 403。已部署栈若曾漏掉 proxy：编辑 compose 补上后执行 \`docker compose up -d --force-recreate docker-guard\`，再重试更新。

{{DEPLOY_DATA_SECTION}}

## 救援

\`\`\`bash
docker exec myriad-updater myriad-rescue status
docker exec myriad-updater myriad-rescue exit-maintenance --force
\`\`\`

临时直连：\`PROXY_ALLOW_DIRECT_UPDATER=true\`。

## 版本

MYRIAD_TAG={{MYRIAD_TAG}} · PROXY_TAG={{PROXY_TAG}} · UPDATER_TAG={{UPDATER_TAG}}  
禁止 \`:latest\`。生产建议 pin digest：tag 填 \`vX.Y.Z@sha256:<64hex>\`，生成器会写入完整 image 引用。

## 生成后自检（务必）

\`\`\`bash
# Compose 语法
docker compose -f docker-compose.yml --env-file .env config >/dev/null

# 外层 Nginx（路径按面板调整）
nginx -t
# 或：docker exec <nginx容器> nginx -t
\`\`\`

本工具的 Nginx 改写是启发式解析（引号/注释/大括号），**不能替代** \`nginx -t\`。
`;

// ========================================
// 工具函数
// ========================================

// 生成 URL/连接串安全的随机串（避免 DATABASE_URL 被特殊字符破坏）
function generateSecret(length) {
  var charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var out = '';
  var array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (var i = 0; i < length; i++) {
    out += charset[array[i] % charset.length];
  }
  return out;
}

// UPDATE_TOKEN / UPDATER_GATEWAY_SECRET：URL-safe 风格（对齐 deploy.sh）
function generateUpdateToken() {
  var charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  var out = '';
  var array = new Uint8Array(48);
  crypto.getRandomValues(array);
  for (var i = 0; i < 48; i++) {
    out += charset[array[i] % charset.length];
  }
  return out;
}

function generateUpdaterGatewaySecret() {
  return generateUpdateToken();
}

function generateJwtSecret() {
  return generateSecret(64);
}

function generatePassword() {
  return generateSecret(40);
}

function generateSetupSecret() {
  return generateSecret(48);
}

// ========================================
// 安全：dotenv token / 内存 / PG / 上传限制
// ========================================

/** 直接写入未加引号 .env 的密钥：仅 [A-Za-z0-9_-]，≥32，禁 CR/LF/NUL/#/=/空白 */
var DOTENV_TOKEN_RE = /^[A-Za-z0-9_-]{32,512}$/;
var NGINX_UPLOAD_MAX_BYTES = 512 * 1024;
var PG_VERSION_MIN = 18;
var PG_VERSION_MAX = 20;
var MEM_MIN_BYTES = 16 * 1024 * 1024;       // 16MiB
var MEM_MAX_BYTES = 256 * 1024 * 1024 * 1024; // 256GiB
var EXPECTED_ENV_KEYS_BASE = [
  'MYRIAD_TAG', 'PROXY_TAG', 'UPDATER_TAG', 'BACKEND_IMAGE', 'FRONTEND_IMAGE',
  'COMPOSE_PROJECT_NAME', 'UPDATE_TOKEN', 'UPDATER_GATEWAY_SECRET', 'CHANNEL',
  'UPDATE_MODE', 'MYRIAD_GITHUB_REPO', 'CHECK_INTERVAL_SECS',
  'HTTP_BIND_ADDRESS', 'HTTP_PORT', 'PROXY_ALLOW_DIRECT_UPDATER',
  'COSIGN_VERIFY', 'MYRIAD_DB_MODE', 'DATABASE_URL', 'JWT_SECRET',
  'MYRIAD_SETUP_SECRET', 'CORS_ORIGINS', 'BASE_URL', 'FRONTEND_URL'
];

function isSafeDotenvToken(value) {
  if (typeof value !== 'string') return false;
  if (/[\r\n\0]/.test(value)) return false;
  return DOTENV_TOKEN_RE.test(value);
}

function requireSafeDotenvToken(value, label) {
  if (!isSafeDotenvToken(value)) {
    throw new Error(
      (label || '密钥') +
      ' 必须是 32–512 位，且只能含 A-Za-z0-9_-（禁止换行、空格、#、= 等，避免 .env 注入）'
    );
  }
  return value;
}

/**
 * 严格 dotenv 行解析（无引号 KEY=VALUE）。拒绝 CR/LF/NUL、重复键、非法键名。
 * @returns {{ map: Record<string,string>, keys: string[] }}
 */
function parseDotenvStrict(text) {
  var map = {};
  var keys = [];
  var lines = String(text == null ? '' : text).split('\n');
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.indexOf('\r') !== -1 || line.indexOf('\0') !== -1) {
      throw new Error('.env 第 ' + (i + 1) + ' 行含 CR/NUL，已拒绝');
    }
    if (!line || /^\s*$/.test(line) || /^\s*#/.test(line)) continue;
    var eq = line.indexOf('=');
    if (eq <= 0) {
      throw new Error('.env 第 ' + (i + 1) + ' 行不是 KEY=VALUE');
    }
    var key = line.slice(0, eq);
    var val = line.slice(eq + 1);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error('.env 非法键名: ' + key);
    }
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      throw new Error('.env 重复键: ' + key + '（可能被注入）');
    }
    if (/[\r\n\0]/.test(val)) {
      throw new Error('.env 键 ' + key + ' 的值含换行/NUL');
    }
    map[key] = val;
    keys.push(key);
  }
  return { map: map, keys: keys };
}

/**
 * 生成后自检：密钥未注入多行、期望键齐全、PROXY_ALLOW 等关键项未被篡改。
 */
function validateGeneratedEnv(envText, secrets, opts) {
  opts = opts || {};
  var parsed = parseDotenvStrict(envText);
  var requiredSecrets = ['JWT_SECRET', 'UPDATE_TOKEN', 'UPDATER_GATEWAY_SECRET', 'MYRIAD_SETUP_SECRET'];
  for (var i = 0; i < requiredSecrets.length; i++) {
    var k = requiredSecrets[i];
    if (parsed.map[k] !== secrets[k]) {
      throw new Error(k + ' 写入 .env 后与输入不一致（疑似注入或转义错误）');
    }
    requireSafeDotenvToken(parsed.map[k], k);
  }
  if (parsed.map.PROXY_ALLOW_DIRECT_UPDATER !== 'false') {
    throw new Error('PROXY_ALLOW_DIRECT_UPDATER 必须为 false（生成器固定值）');
  }
  var allowCount = (String(envText).match(/^PROXY_ALLOW_DIRECT_UPDATER=/gm) || []).length;
  if (allowCount !== 1) {
    throw new Error('PROXY_ALLOW_DIRECT_UPDATER 出现 ' + allowCount + ' 次，拒绝生成');
  }
  var expected = EXPECTED_ENV_KEYS_BASE.slice();
  if (opts.bundled) {
    expected = expected.concat(['POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD']);
  }
  for (var j = 0; j < expected.length; j++) {
    if (!Object.prototype.hasOwnProperty.call(parsed.map, expected[j])) {
      throw new Error('.env 缺少期望键: ' + expected[j]);
    }
  }
  if (opts.bundled) {
    requireSafeDotenvToken(parsed.map.POSTGRES_PASSWORD, 'POSTGRES_PASSWORD');
    if (parsed.map.POSTGRES_PASSWORD !== secrets.POSTGRES_PASSWORD) {
      throw new Error('POSTGRES_PASSWORD 写入不一致');
    }
  }
  return parsed;
}

function parseMemoryToBytes(value) {
  var m = String(value || '').trim().match(/^(\d+(?:\.\d+)?)([KMGTP])i?B?$/i);
  if (!m) return null;
  var n = parseFloat(m[1]);
  if (!(n > 0) || !isFinite(n)) return null;
  var unit = m[2].toUpperCase();
  var mult = { K: 1024, M: 1024 * 1024, G: 1024 * 1024 * 1024, T: 1024 * 1024 * 1024 * 1024, P: Math.pow(1024, 5) };
  return Math.floor(n * mult[unit]);
}

function isValidMemoryLimit(value) {
  var bytes = parseMemoryToBytes(value);
  if (bytes == null) return false;
  return bytes >= MEM_MIN_BYTES && bytes <= MEM_MAX_BYTES;
}

function isValidPgMajor(version) {
  if (!/^\d+$/.test(String(version))) return false;
  var n = Number(version);
  return n >= PG_VERSION_MIN && n <= PG_VERSION_MAX;
}

/**
 * 镜像引用：versioned tag，可选 @sha256:<64hex>
 * @returns {{ tag: string, digest: string|null, raw: string }|null}
 */
function parseImageRef(raw) {
  var s = String(raw || '').trim();
  if (!s || /^latest$/i.test(s)) return null;
  var digest = null;
  var tagPart = s;
  var digMatch = s.match(/^(.*)@sha256:([a-fA-F0-9]{64})$/i);
  if (digMatch) {
    tagPart = digMatch[1];
    digest = digMatch[2].toLowerCase();
  }
  if (!parseVersionTag(tagPart)) return null;
  return { tag: tagPart, digest: digest, raw: s };
}

function buildImageRef(repoDefault, tag, digest) {
  var base = repoDefault.replace(/\/$/, '');
  if (digest) return base + '@sha256:' + digest;
  return base + ':' + tag;
}

function summarizeNginxDiff(before, after, domain) {
  var lines = [];
  if (!before) {
    lines.push('使用默认 Nginx 模板（未上传）');
  } else {
    lines.push('基于上传配置改写域名 → ' + domain);
    if (before !== after) {
      if (/location\s+\/\s*\{/.test(after) && /proxy_pass\s+http:\/\/127\.0\.0\.1:/.test(after)) {
        lines.push('已将 location / 指向 Myriad proxy（整站反代）');
      }
      if (/acme-challenge/.test(after) && !/acme-challenge/.test(before)) {
        lines.push('已注入 ACME challenge 本地 root');
      }
      lines.push('原文 ' + before.length + ' 字节 → 结果 ' + after.length + ' 字节');
    } else {
      lines.push('内容未变化（请人工核对 server_name / proxy_pass）');
    }
  }
  lines.push('手写解析器不能替代 nginx -t；上线前请在目标机执行下方校验命令');
  return lines;
}

// 替换 Nginx 配置中的域名（含宝塔路径与常见 Let's Encrypt 路径）
function replaceNginxDomain(config, newDomain) {
  var oldDomain = extractDomain(config);

  config = config.replace(/server_name\s+([^;]+);/g, function(directive, namesText) {
    var names = namesText.trim().split(/\s+/);
    if (!oldDomain || names.indexOf(oldDomain) === -1) return directive;
    return 'server_name ' + newDomain + ';';
  });

  // 1Panel / 宝塔 / 通用 常见站点目录
  if (oldDomain) {
    var pairs = [
      ['/www/sites/' + oldDomain + '/', '/www/sites/' + newDomain + '/'],
      ['/www/wwwroot/' + oldDomain, '/www/wwwroot/' + newDomain],
      ['/www/wwwlogs/' + oldDomain, '/www/wwwlogs/' + newDomain],
      ['/var/www/' + oldDomain + '/', '/var/www/' + newDomain + '/'],
      ['/var/log/nginx/' + oldDomain, '/var/log/nginx/' + newDomain]
    ];
    pairs.forEach(function (pair) {
      config = config.split(pair[0]).join(pair[1]);
    });
  }

  // Let's Encrypt live / archive 路径
  if (oldDomain && oldDomain !== newDomain) {
    var leLive = new RegExp('/etc/letsencrypt/live/' + escapeRegExp(oldDomain) + '/', 'g');
    var leArchive = new RegExp('/etc/letsencrypt/archive/' + escapeRegExp(oldDomain) + '/', 'g');
    config = config.replace(leLive, '/etc/letsencrypt/live/' + newDomain + '/');
    config = config.replace(leArchive, '/etc/letsencrypt/archive/' + newDomain + '/');
  } else {
    config = config.replace(/\/etc\/letsencrypt\/live\/[^/]+\//g, '/etc/letsencrypt/live/' + newDomain + '/');
    config = config.replace(/\/etc\/letsencrypt\/archive\/[^/]+\//g, '/etc/letsencrypt/archive/' + newDomain + '/');
  }

  return config;
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ========================================
// Docker Hub 最新 versioned tag 解析
// ========================================

var DOCKER_REPOS = {
  backend: 'myriad-backend',
  frontend: 'myriad-frontend',
  proxy: 'myriad-proxy',
  updater: 'myriad-updater'
};

var tagFetchState = {
  loading: false,
  /** @type {Promise<object|null>|null} */
  inflight: null,
  lastError: '',
  lastResolved: null,
  channelTouched: false
};

function parseVersionTag(tag) {
  if (!tag || typeof tag !== 'string') return null;
  // 接受 v1.2.3 / 1.2.3 / v1.2.3-rc.1 / v1.2.3-beta.1 / v1.2.3-nightly.20260101
  var m = tag.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/i);
  if (!m) return null;
  return {
    raw: tag,
    major: parseInt(m[1], 10),
    minor: parseInt(m[2], 10),
    patch: parseInt(m[3], 10),
    pre: m[4] || null
  };
}

function comparePreRelease(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;  // 无 pre 的正式版更新
  if (!b) return -1;
  var pa = a.split('.');
  var pb = b.split('.');
  var n = Math.max(pa.length, pb.length);
  for (var i = 0; i < n; i++) {
    var xa = pa[i];
    var xb = pb[i];
    if (xa === undefined) return -1;
    if (xb === undefined) return 1;
    var na = /^\d+$/.test(xa) ? parseInt(xa, 10) : null;
    var nb = /^\d+$/.test(xb) ? parseInt(xb, 10) : null;
    if (na !== null && nb !== null) {
      if (na !== nb) return na - nb;
    } else {
      if (xa < xb) return -1;
      if (xa > xb) return 1;
    }
  }
  return 0;
}

function compareSemver(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  return comparePreRelease(a.pre, b.pre);
}

function pickLatestVersionedTag(tagNames) {
  var parsed = [];
  for (var i = 0; i < tagNames.length; i++) {
    var p = parseVersionTag(tagNames[i]);
    if (p) parsed.push(p);
  }
  if (!parsed.length) return null;
  parsed.sort(function(a, b) { return compareSemver(b, a); });
  return parsed[0].raw;
}

function pickLatestCommonVersionedTag(tagLists) {
  if (!tagLists || !tagLists.length) return null;
  var sets = tagLists.map(function(list) {
    var s = {};
    for (var i = 0; i < list.length; i++) s[list[i]] = true;
    return s;
  });
  var candidates = [];
  var first = tagLists[0] || [];
  for (var i = 0; i < first.length; i++) {
    var tag = first[i];
    if (!parseVersionTag(tag)) continue;
    var ok = true;
    for (var j = 1; j < sets.length; j++) {
      if (!sets[j][tag]) { ok = false; break; }
    }
    if (ok) candidates.push(tag);
  }
  return pickLatestVersionedTag(candidates);
}

function suggestChannelFromTag(tag) {
  var parsed = parseVersionTag(String(tag || ''));
  return parsed && parsed.pre ? 'preview' : 'stable';
}

function extractTagNamesFromHubPayload(data) {
  if (!data) return [];
  // Tapp.api 返回 data 字段；有时可能再包一层
  var payload = data;
  if (payload.data && (payload.data.results || Array.isArray(payload.data))) {
    payload = payload.data;
  }
  var results = payload.results;
  if (!Array.isArray(results)) return [];
  var names = [];
  for (var i = 0; i < results.length; i++) {
    if (results[i] && results[i].name) names.push(results[i].name);
  }
  return names;
}

async function fetchDockerHubTags(repo) {
  // 优先走声明式 Tapp.api（沙箱内禁止裸 fetch）
  if (typeof Tapp !== 'undefined' && typeof Tapp.api === 'function') {
    var data = await Tapp.api('dockerHubTags', { repo: repo });
    return extractTagNamesFromHubPayload(data);
  }
  // 开发/测试环境降级
  if (typeof fetch === 'function') {
    var url = 'https://hub.docker.com/v2/repositories/somekawahitomi/' +
      encodeURIComponent(repo) +
      '/tags?page_size=100&ordering=-last_updated';
    var resp = await fetch(url);
    if (!resp.ok) throw new Error('Docker Hub HTTP ' + resp.status);
    var json = await resp.json();
    return extractTagNamesFromHubPayload(json);
  }
  throw new Error('当前环境无法请求 Docker Hub');
}

function setTagStatus(message, kind) {
  var el = document.getElementById('tag-status');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('is-loading', 'is-ok', 'is-error');
  if (kind) el.classList.add('is-' + kind);
}

function shouldFillTagInput(input, force) {
  if (!input) return false;
  if (force) return true;
  var v = (input.value || '').trim();
  if (!v) return true;
  // 仅覆盖自动填充过的字段，保留用户手改
  return input.dataset.autoFilled === 'true';
}

function applyResolvedTags(resolved, inputs, channelSelect, opts) {
  if (!resolved) return;
  opts = opts || {};
  var force = !!opts.force;

  if (shouldFillTagInput(inputs.myriad, force) && resolved.myriadTag) {
    inputs.myriad.value = resolved.myriadTag;
    inputs.myriad.dataset.autoFilled = 'true';
  }
  if (shouldFillTagInput(inputs.proxy, force) && resolved.proxyTag) {
    inputs.proxy.value = resolved.proxyTag;
    inputs.proxy.dataset.autoFilled = 'true';
  }
  if (shouldFillTagInput(inputs.updater, force) && resolved.updaterTag) {
    inputs.updater.value = resolved.updaterTag;
    inputs.updater.dataset.autoFilled = 'true';
  }

  // state 始终反映输入框当前值
  state.myriadTag = ((inputs.myriad && inputs.myriad.value) || resolved.myriadTag || '').trim();
  state.proxyTag = ((inputs.proxy && inputs.proxy.value) || resolved.proxyTag || '').trim();
  state.updaterTag = ((inputs.updater && inputs.updater.value) || resolved.updaterTag || '').trim();

  if (channelSelect && !tagFetchState.channelTouched) {
    var suggested = suggestChannelFromTag(resolved.myriadTag || resolved.proxyTag || resolved.updaterTag);
    channelSelect.value = suggested;
    state.channel = suggested;
  }
}

async function resolveLatestImageTags() {
  // allSettled：单个仓库失败不拖垮整次解析
  var settled = await Promise.allSettled([
    fetchDockerHubTags(DOCKER_REPOS.backend),
    fetchDockerHubTags(DOCKER_REPOS.frontend),
    fetchDockerHubTags(DOCKER_REPOS.proxy),
    fetchDockerHubTags(DOCKER_REPOS.updater)
  ]);
  var names = ['backend', 'frontend', 'proxy', 'updater'];
  var lists = settled.map(function (r) {
    return r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : [];
  });
  var failures = [];
  for (var i = 0; i < settled.length; i++) {
    if (settled[i].status === 'rejected') {
      var reason = settled[i].reason;
      failures.push(names[i] + ': ' + ((reason && reason.message) ? reason.message : String(reason)));
    }
  }
  var backendTags = lists[0];
  var frontendTags = lists[1];
  var proxyTags = lists[2];
  var updaterTags = lists[3];

  // 优先四仓共同 versioned tag（兼容矩阵最稳）
  var allCommon = pickLatestCommonVersionedTag([backendTags, frontendTags, proxyTags, updaterTags]);
  var myriadTag = allCommon || pickLatestCommonVersionedTag([backendTags, frontendTags]);
  if (!myriadTag) {
    myriadTag = pickLatestVersionedTag(backendTags) || pickLatestVersionedTag(frontendTags);
  }
  // proxy/updater：有共同矩阵时对齐；否则各自最新，并标记可能不一致
  var proxyTag = allCommon || pickLatestVersionedTag(proxyTags) || myriadTag;
  var updaterTag = allCommon || pickLatestVersionedTag(updaterTags) || myriadTag;

  if (!myriadTag && !proxyTag && !updaterTag) {
    var detail = failures.length ? '（' + failures.join('; ') + '）' : '';
    throw new Error('Docker Hub 上未找到可用的 versioned tag（vX.Y.Z）' + detail);
  }

  var aligned = !!(allCommon && proxyTag === myriadTag && updaterTag === myriadTag);

  return {
    myriadTag: myriadTag || '',
    proxyTag: proxyTag || '',
    updaterTag: updaterTag || '',
    backendCount: backendTags.length,
    frontendCount: frontendTags.length,
    proxyCount: proxyTags.length,
    updaterCount: updaterTags.length,
    failures: failures,
    versionAligned: aligned,
    commonTag: allCommon || ''
  };
}

async function refreshLatestTags(inputs, channelSelect, opts) {
  opts = opts || {};
  // 复用进行中的请求，避免「启动拉取未完成时点生成」误失败
  if (tagFetchState.inflight) {
    return tagFetchState.inflight;
  }

  tagFetchState.loading = true;
  tagFetchState.lastError = '';

  var btn = document.getElementById('btn-refresh-tags');
  if (btn) btn.disabled = true;
  setTagStatus('正在从 Docker Hub 获取最新 versioned tag…', 'loading');

  tagFetchState.inflight = (async function() {
    try {
      var resolved = await resolveLatestImageTags();
      tagFetchState.lastResolved = resolved;
      // 手动点「刷新」时强制覆盖；自动拉取只填空/自动字段
      applyResolvedTags(resolved, inputs, channelSelect, { force: !!opts.force });
      var alignNote = resolved.versionAligned
        ? ' · 四组件同版本'
        : ' · 组件 tag 可能不一致，请确认兼容';
      var failNote = (resolved.failures && resolved.failures.length)
        ? ' · 部分仓库失败: ' + resolved.failures.join('; ')
        : '';
      setTagStatus(
        '已解析：MYRIAD=' + resolved.myriadTag +
        ' · PROXY=' + resolved.proxyTag +
        ' · UPDATER=' + resolved.updaterTag +
        alignNote + failNote + '（禁止 :latest；生产可加 @sha256:…）',
        resolved.failures && resolved.failures.length ? 'error' : 'ok'
      );
      if (opts.notify) {
        showNotification(
          resolved.versionAligned
            ? '已更新为 Docker Hub 共同 versioned tag'
            : '已更新 tag（proxy/updater 可能与 MYRIAD 不同版本）',
          'success'
        );
      }
      return resolved;
    } catch (err) {
      var msg = (err && err.message) ? err.message : String(err);
      tagFetchState.lastError = msg;
      setTagStatus('获取失败：' + msg + '。请手动填写 versioned tag。', 'error');
      if (opts.notify) {
        showNotification('获取最新版本失败：' + msg, 'error');
      }
      return null;
    } finally {
      tagFetchState.loading = false;
      tagFetchState.inflight = null;
      if (btn) btn.disabled = false;
    }
  })();

  return tagFetchState.inflight;
}

// Whole-site reverse proxy to Myriad proxy — never rewrite to /api-only.
// Federation paths that MUST reach proxy: /.well-known/webfinger, /.well-known/nodeinfo,
// /nodeinfo/2.1, /inbox, /users/, /api/* (WS under /api/federation/*/ws).
function buildNginxProxyLocation(httpPort, indent) {
  var childIndent = indent + '    ';
  return [
    indent + '# Whole-site → Myriad proxy (SPA + /api + federation). Do NOT proxy only /api.',
    indent + '# Must reach proxy: /.well-known/webfinger, /.well-known/nodeinfo, /nodeinfo/2.1,',
    indent + '# /inbox, /users/, /api/* (incl. WS /api/federation/*/ws). Preserve Host for HTTP Signatures.',
    indent + 'location / {',
    childIndent + 'proxy_pass http://127.0.0.1:' + httpPort + ';',
    '',
    childIndent + 'proxy_set_header Host $host;',
    childIndent + 'proxy_set_header X-Real-IP $remote_addr;',
    childIndent + 'proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    childIndent + 'proxy_set_header X-Forwarded-Proto $scheme;',
    '',
    childIndent + 'proxy_http_version 1.1;',
    childIndent + 'proxy_set_header Upgrade $http_upgrade;',
    childIndent + 'proxy_set_header Connection "upgrade";',
    '',
    childIndent + 'proxy_connect_timeout 300s;',
    childIndent + 'proxy_send_timeout 300s;',
    childIndent + 'proxy_read_timeout 300s;',
    childIndent + 'proxy_buffering off;',
    childIndent + 'client_max_body_size 50M;',
    indent + '}'
  ].join('\n');
}

function extractNginxRoot(serverConfig, domain, panelId) {
  var match = serverConfig.match(/(?:^|\n)[ \t]*root\s+([^;]+);/);
  if (match) return match[1].trim();
  var profile = getPanelProfile(panelId || (typeof state !== 'undefined' && state.panelId) || '1panel');
  if (domain) return profile.siteRoot(domain);
  return profile.siteRoot('default');
}

function hasAcmeChallengeLocation(serverConfig) {
  return /location\s+\^~\s+\/\.well-known\/acme-challenge\//.test(serverConfig);
}

function buildAcmeChallengeLocation(siteRoot, indent) {
  var childIndent = indent + '    ';
  return [
    indent + '# ACME (1Panel/certbot): local root BEFORE catch-all. Other /.well-known/* via proxy.',
    indent + 'location ^~ /.well-known/acme-challenge/ {',
    childIndent + 'root ' + siteRoot + ';',
    childIndent + 'allow all;',
    indent + '}'
  ].join('\n');
}

// Ensure ACME challenge is local; keep other /.well-known/* on the whole-site proxy.
function ensureAcmeChallengeLocation(serverConfig, domain, serverIndent, panelId) {
  if (hasAcmeChallengeLocation(serverConfig)) return serverConfig;

  var childIndent = serverIndent + '    ';
  var acmeBlock = buildAcmeChallengeLocation(
    extractNginxRoot(serverConfig, domain, panelId),
    childIndent
  );
  var rootLocation = /(^|\n)([ \t]*)location\s+(?:(?:=|\^~)\s+)?\/\s*\{/;
  var match = rootLocation.exec(serverConfig);
  if (match) {
    var insertAt = match.index + match[1].length;
    return serverConfig.slice(0, insertAt) + acmeBlock + '\n\n' + serverConfig.slice(insertAt);
  }

  var closeBrace = serverConfig.lastIndexOf('}');
  if (closeBrace === -1) return serverConfig;
  return serverConfig.slice(0, closeBrace).replace(/[ \t]*$/, '') +
    '\n\n' + acmeBlock + '\n' + serverConfig.slice(closeBrace);
}

function findClosingBrace(config, openBraceIndex) {
  var depth = 0;
  var quote = '';
  var escaped = false;
  var inComment = false;

  for (var i = openBraceIndex; i < config.length; i += 1) {
    var char = config[i];

    if (inComment) {
      if (char === '\n') inComment = false;
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }
    if (char === '#') {
      inComment = true;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function replaceRootLocation(config, httpPort) {
  var rootLocation = /(^|\n)([ \t]*)location\s+(?:(?:=|\^~)\s+)?\/\s*\{/g;
  var match = rootLocation.exec(config);
  if (!match) return null;

  var start = match.index + match[1].length;
  var openBrace = config.indexOf('{', start);
  var closeBrace = findClosingBrace(config, openBrace);
  if (closeBrace === -1) return null;

  var proxyLocation = buildNginxProxyLocation(httpPort, match[2]);
  return config.slice(0, start) + proxyLocation + config.slice(closeBrace + 1);
}

function findServerBlocks(config) {
  var blocks = [];
  var serverPattern = /^([ \t]*)server\s*\{/gm;
  var match;

  while ((match = serverPattern.exec(config)) !== null) {
    var openBrace = config.indexOf('{', match.index);
    var closeBrace = findClosingBrace(config, openBrace);
    if (closeBrace === -1) break;
    blocks.push({
      start: match.index,
      end: closeBrace + 1,
      indent: match[1],
      text: config.slice(match.index, closeBrace + 1)
    });
    serverPattern.lastIndex = closeBrace + 1;
  }

  return blocks;
}

function serverHasDomain(serverConfig, domain) {
  var directives = serverConfig.match(/server_name\s+[^;]+;/g) || [];
  return directives.some(function(directive) {
    var names = directive.replace(/^server_name\s+/, '').replace(/;$/, '').trim().split(/\s+/);
    return names.indexOf(domain) !== -1;
  });
}

function isRedirectOnlyServer(serverConfig) {
  var servesTls = /\blisten\b[^;]*\bssl\b/.test(serverConfig) || /\bssl_certificate\b/.test(serverConfig);
  var redirectIndex = serverConfig.search(/\breturn\s+30(?:1|2|7|8)\b/);
  var firstLocationIndex = serverConfig.search(/\blocation\b/);
  var redirectsWholeServer = redirectIndex !== -1 &&
    (firstLocationIndex === -1 || redirectIndex < firstLocationIndex);
  var hasUpstreamHandler = /\b(?:proxy_pass|fastcgi_pass|uwsgi_pass|grpc_pass)\b/.test(serverConfig);
  return !servesTls && redirectsWholeServer && !hasUpstreamHandler;
}

function transformServerBlock(serverConfig, httpPort, serverIndent, domain, panelId) {
  var childIndent = serverIndent + '    ';
  var proxyLocation = buildNginxProxyLocation(httpPort, childIndent);
  var profile = getPanelProfile(panelId || '1panel');
  var proxyInclude = profile.proxyIncludeRe
    ? new RegExp(profile.proxyIncludeRe.source, profile.proxyIncludeRe.flags)
    : /^[ \t]*include\s+[^;\n]*\/proxy\/\*\.conf\s*;[ \t]*$/gm;
  var replacedRoot = replaceRootLocation(serverConfig, httpPort);
  var next = serverConfig;

  if (replacedRoot !== null) {
    // Myriad 独占根路径（整站反代，非 /api-only）；移除面板外置代理 include，避免重复 location /。
    next = replacedRoot.replace(proxyInclude, '');
  } else if (proxyInclude.test(serverConfig)) {
    proxyInclude.lastIndex = 0;
    // Replace panel proxy include with whole-site location / (keeps federation paths).
    next = serverConfig.replace(proxyInclude, proxyLocation);
  } else {
    var closeBrace = serverConfig.lastIndexOf('}');
    next = serverConfig.slice(0, closeBrace).replace(/[ \t]*$/, '') +
      '\n\n' + proxyLocation + '\n' + serverConfig.slice(closeBrace);
  }

  return ensureAcmeChallengeLocation(next, domain, serverIndent, panelId);
}

// 将上传的站点配置规范化为 Myriad proxy 整站入口（非 /api-only）。
// 支持同一站点常见的 HTTP 跳转块 + HTTPS 服务块，不修改其他域名。
function replaceNginxUpstreamToProxy(config, httpPort, domain, panelId) {
  var blocks = findServerBlocks(config);
  var replacements = blocks.filter(function(block) {
    return serverHasDomain(block.text, domain) && !isRedirectOnlyServer(block.text);
  }).map(function(block) {
    return {
      start: block.start,
      end: block.end,
      text: transformServerBlock(block.text, httpPort, block.indent, domain, panelId)
    };
  });

  // 从后向前替换，保持前面 block 的索引稳定。
  replacements.reverse().forEach(function(replacement) {
    config = config.slice(0, replacement.start) + replacement.text + config.slice(replacement.end);
  });

  if (replacements.length === 0) {
    throw new Error('上传的 Nginx 配置中未找到域名 ' + domain + ' 的可用 server 块');
  }

  return config;
}

function extractDomain(config) {
  var match = config.match(/server_name\s+([^;]+);/);
  if (match) {
    return match[1].trim().split(/\s+/)[0];
  }
  return null;
}

function normalizeDomain(domain) {
  return domain
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .toLowerCase();
}

function isValidDomain(domain) {
  if (!domain || domain.length > 253) return false;
  // 宽松校验：hostname 形态
  return /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain)
    || domain === 'localhost';
}

function buildCorsOrigins(mainDomain, extraDomain) {
  var origins = ['https://' + mainDomain];
  if (extraDomain && extraDomain !== mainDomain) {
    origins.push('https://' + extraDomain);
  }
  // 常见 www 变体：若主域不是 www 且用户没填额外域，不自动加 www（避免 CORS 过宽）
  return origins.join(',');
}

// Host reachable from backend container (IP / hostname / host.docker.internal)
function isValidDbHost(host) {
  if (!host || typeof host !== 'string') return false;
  var h = host.trim();
  if (!h || h.length > 253) return false;
  if (h === 'localhost' || h === 'host.docker.internal') return true;
  // IPv4
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) {
    var parts = h.split('.');
    for (var i = 0; i < parts.length; i++) {
      var n = Number(parts[i]);
      if (n < 0 || n > 255) return false;
    }
    return true;
  }
  // hostname (incl. docker DNS names)
  return /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i.test(h);
}

var SSLMODE_ALLOWED = {
  '': true,
  disable: true,
  allow: true,
  prefer: true,
  require: true,
  'verify-ca': true,
  'verify-full': true
};

// Build postgres:// URL with encoded user/password; optional sslmode query.
function buildDatabaseUrl(opts) {
  var user = opts.user;
  var password = opts.password;
  var host = opts.host;
  var port = opts.port;
  var database = opts.database;
  var sslmode = (opts.sslmode || '').trim();
  var url = 'postgres://' +
    encodeURIComponent(user) + ':' +
    encodeURIComponent(password) +
    '@' + host + ':' + port + '/' +
    encodeURIComponent(database);
  if (sslmode) {
    url += '?sslmode=' + encodeURIComponent(sslmode);
  }
  return url;
}

// ========================================
// 状态
// ========================================

var state = {
  mainDomain: '',
  extraDomain: '',
  dbPassword: '',
  jwtSecret: '',
  updateToken: '',
  updaterGatewaySecret: '',
  setupSecret: '',
  nginxConfig: null,
  nginxFileName: '',
  extraNginxConfig: null,
  extraNginxFileName: '',
  httpBindAddress: '127.0.0.1',
  httpPort: 8080,
  // 1panel | baota | generic — paths + deploy instructions
  panelId: '1panel',
  // bundled = compose postgres; external = user-managed PG
  dbMode: 'bundled',
  dbVersion: '18',
  dbName: 'myriad',
  dbUser: 'myriad',
  dbHost: '',
  dbPort: 5432,
  dbSslmode: '',
  dbCpuLimit: '2.0',
  dbMemLimit: '2G',
  // 运行时由 Docker Hub 解析填充，不在源码中写死版本
  myriadTag: '',
  proxyTag: '',
  updaterTag: '',
  myriadDigest: null,
  proxyDigest: null,
  updaterDigest: null,
  channel: 'stable',
  cosignVerify: 'strict',
  // PostgreSQL / backend / frontend 可按宿主机条件限制
  backendCpuLimit: '2.0',
  backendMemLimit: '4G',
  frontendCpuLimit: '2.0',
  frontendMemLimit: '2G',
  netMyriad: 'myriad-net',
  netAdmin: 'myriad-admin-net',
  netGuard: 'myriad-docker-guard-net',
  dbExtraNetwork: ''
};

// ========================================
// UI 交互
// ========================================

/** 页面监听解绑表；重挂载 / unload 时清空，避免重复绑定 */
var pageLifecycle = {
  ready: false,
  unsubs: []
};

function disposePage() {
  var list = pageLifecycle.unsubs.slice();
  pageLifecycle.unsubs = [];
  pageLifecycle.ready = false;
  for (var i = 0; i < list.length; i++) {
    try { list[i](); } catch (e) { /* ignore */ }
  }
}

function initPage() {
  if (pageLifecycle.ready) {
    disposePage();
  }
  pageLifecycle.ready = true;

  var mainDomainInput = document.getElementById('main-domain');
  var extraDomainInput = document.getElementById('extra-domain');
  var dbPasswordInput = document.getElementById('db-password');
  var jwtSecretInput = document.getElementById('jwt-secret');
  var updateTokenInput = document.getElementById('update-token');
  var gatewaySecretInput = document.getElementById('updater-gateway-secret');
  var setupSecretInput = document.getElementById('setup-secret');
  var dbNameInput = document.getElementById('db-name');
  var dbUserInput = document.getElementById('db-user');
  var dbHostInput = document.getElementById('db-host');
  var dbPortInput = document.getElementById('db-port');
  var dbSslmodeSelect = document.getElementById('db-sslmode');
  var dbModeBundledFields = document.getElementById('db-mode-bundled-fields');
  var dbModeExternalFields = document.getElementById('db-mode-external-fields');
  var dbResourceGroup = document.getElementById('db-resource-group');
  var dbModeRadios = document.querySelectorAll('input[name="db-mode"]');

  var genDbPasswordBtn = document.getElementById('gen-db-password');
  var genJwtSecretBtn = document.getElementById('gen-jwt-secret');
  var genUpdateTokenBtn = document.getElementById('gen-update-token');
  var genGatewaySecretBtn = document.getElementById('gen-updater-gateway-secret');
  var genSetupSecretBtn = document.getElementById('gen-setup-secret');
  var generateAllBtn = document.getElementById('btn-generate-all');

  var uploadNginx = document.getElementById('upload-nginx-conf');
  var fileNginx = document.getElementById('file-nginx-conf');
  var uploadExtraNginx = document.getElementById('upload-extra-nginx-conf');
  var fileExtraNginx = document.getElementById('file-extra-nginx-conf');

  var httpBindAddressSelect = document.getElementById('http-bind-address');
  var httpPortInput = document.getElementById('http-port');
  var dbVersionSelect = document.getElementById('db-version');
  var myriadTagInput = document.getElementById('myriad-tag');
  var proxyTagInput = document.getElementById('proxy-tag');
  var updaterTagInput = document.getElementById('updater-tag');
  var channelSelect = document.getElementById('channel');
  var cosignSelect = document.getElementById('cosign-verify');

  var dbCpuLimitInput = document.getElementById('db-cpu-limit');
  var dbMemLimitInput = document.getElementById('db-mem-limit');
  var backendCpuLimitInput = document.getElementById('backend-cpu-limit');
  var backendMemLimitInput = document.getElementById('backend-mem-limit');
  var frontendCpuLimitInput = document.getElementById('frontend-cpu-limit');
  var frontendMemLimitInput = document.getElementById('frontend-mem-limit');
  var netMyriadInput = document.getElementById('net-myriad');
  var netAdminInput = document.getElementById('net-admin');
  var netGuardInput = document.getElementById('net-guard');
  var dbExtraNetworkInput = document.getElementById('db-extra-network');
  var refreshTagsBtn = document.getElementById('btn-refresh-tags');

  var tagInputs = {
    myriad: myriadTagInput,
    proxy: proxyTagInput,
    updater: updaterTagInput
  };

  function getSelectedDbMode() {
    var selected = document.querySelector('input[name="db-mode"]:checked');
    return (selected && selected.value === 'external') ? 'external' : 'bundled';
  }

  function getSelectedPanelId() {
    var selected = document.querySelector('input[name="panel-mode"]:checked');
    var v = selected && selected.value;
    if (v === 'baota' || v === 'generic' || v === '1panel') return v;
    return '1panel';
  }

  function syncPanelModeUi() {
    state.panelId = getSelectedPanelId();
    document.querySelectorAll('.panel-mode-option').forEach(function (label) {
      var input = label.querySelector('input[name="panel-mode"]');
      if (!input) return;
      label.classList.toggle('is-active', input.checked);
    });
    var profile = getPanelProfile(state.panelId);
    var info = document.getElementById('panel-mode-hint');
    if (info) info.textContent = profile.resultsIntro;
  }

  function syncDbModeUi() {
    var mode = getSelectedDbMode();
    state.dbMode = mode;
    var isExternal = mode === 'external';
    if (dbModeBundledFields) dbModeBundledFields.hidden = isExternal;
    if (dbModeExternalFields) dbModeExternalFields.hidden = !isExternal;
    if (dbResourceGroup) dbResourceGroup.hidden = isExternal;
    // Segmented control active styles
    document.querySelectorAll('.db-mode-option').forEach(function(label) {
      var input = label.querySelector('input[name="db-mode"]');
      if (!input) return;
      label.classList.toggle('is-active', input.checked);
    });
  }

  var panelModeRadios = document.querySelectorAll('input[name="panel-mode"]');
  if (panelModeRadios && panelModeRadios.length) {
    panelModeRadios.forEach(function (radio) {
      pageListen(radio, 'change', syncPanelModeUi);
    });
    syncPanelModeUi();
  }

  if (dbModeRadios && dbModeRadios.length) {
    dbModeRadios.forEach(function(radio) {
      pageListen(radio, 'change', syncDbModeUi);
    });
    syncDbModeUi();
  }

  function markTagManual(input) {
    if (!input) return;
    input.dataset.autoFilled = 'false';
  }

  [myriadTagInput, proxyTagInput, updaterTagInput].forEach(function(input) {
    if (!input) return;
    pageListen(input, 'input', function() {
      markTagManual(input);
    });
  });

  if (channelSelect) {
    pageListen(channelSelect, 'change', function() {
      tagFetchState.channelTouched = true;
    });
  }

  pageListen(genDbPasswordBtn, 'click', function() {
    dbPasswordInput.value = generatePassword();
    animateButton(genDbPasswordBtn);
  });

  pageListen(genJwtSecretBtn, 'click', function() {
    jwtSecretInput.value = generateJwtSecret();
    animateButton(genJwtSecretBtn);
  });

  pageListen(genUpdateTokenBtn, 'click', function() {
    updateTokenInput.value = generateUpdateToken();
    animateButton(genUpdateTokenBtn);
  });

  if (genGatewaySecretBtn && gatewaySecretInput) {
    pageListen(genGatewaySecretBtn, 'click', function() {
      gatewaySecretInput.value = generateUpdaterGatewaySecret();
      animateButton(genGatewaySecretBtn);
    });
  }

  if (genSetupSecretBtn && setupSecretInput) {
    pageListen(genSetupSecretBtn, 'click', function() {
      setupSecretInput.value = generateSetupSecret();
      animateButton(genSetupSecretBtn);
    });
  }

  var copySetupSecretBtn = document.getElementById('copy-setup-secret');
  if (copySetupSecretBtn && setupSecretInput) {
    pageListen(copySetupSecretBtn, 'click', function() {
      var value = setupSecretInput.value.trim();
      if (!value) {
        showNotification('还没有安装暗号，先点生成', 'error');
        return;
      }
      copyToClipboard(value, copySetupSecretBtn);
    });
  }

  var copySetupSecretResultBtn = document.getElementById('copy-setup-secret-result');
  if (copySetupSecretResultBtn) {
    pageListen(copySetupSecretResultBtn, 'click', function() {
      var node = document.getElementById('setup-secret-reminder-value');
      var value = ((node && node.textContent) || state.setupSecret || '').trim();
      if (!value) {
        showNotification('还没有安装暗号', 'error');
        return;
      }
      copyToClipboard(value, copySetupSecretResultBtn);
    });
  }

  if (refreshTagsBtn) {
    pageListen(refreshTagsBtn, 'click', function() {
      // 用户明确刷新：覆盖自动/当前值为最新
      refreshLatestTags(tagInputs, channelSelect, { notify: true, force: true });
    });
  }

  setupFileUpload(uploadNginx, fileNginx, function(content, fileName) {
    state.nginxConfig = content;
    state.nginxFileName = fileName;
    showUploadSuccess(uploadNginx, fileName);
  }, function() {
    state.nginxConfig = null;
    state.nginxFileName = '';
  });

  if (uploadExtraNginx && fileExtraNginx) {
    setupFileUpload(uploadExtraNginx, fileExtraNginx, function(content, fileName) {
      state.extraNginxConfig = content;
      state.extraNginxFileName = fileName;
      showUploadSuccess(uploadExtraNginx, fileName);
    }, function() {
      state.extraNginxConfig = null;
      state.extraNginxFileName = '';
    });
  }

  pageListen(generateAllBtn, 'click', async function() {
    if (generateAllBtn.disabled) return;
    generateAllBtn.disabled = true;

    try {
      var mainDomain = normalizeDomain(mainDomainInput.value);
      var extraDomain = normalizeDomain(extraDomainInput.value || '');
      var dbPassword = dbPasswordInput.value.trim();
      var jwtSecret = jwtSecretInput.value.trim();
      var updateToken = updateTokenInput.value.trim();
      var gatewaySecret = gatewaySecretInput ? gatewaySecretInput.value.trim() : '';
      var setupSecret = setupSecretInput ? setupSecretInput.value.trim() : '';
      var dbName = dbNameInput.value.trim();
      var dbUser = dbUserInput.value.trim();
      var dbMode = getSelectedDbMode();
      var isExternal = dbMode === 'external';
      state.panelId = getSelectedPanelId();

      if (!mainDomain) {
        showNotification('请输入主域名', 'error');
        mainDomainInput.focus();
        return;
      }

      if (!isValidDomain(mainDomain)) {
        showNotification('主域名格式无效', 'error');
        mainDomainInput.focus();
        return;
      }

      if (extraDomain && !isValidDomain(extraDomain)) {
        showNotification('额外域名格式无效', 'error');
        extraDomainInput.focus();
        return;
      }

      var postgresIdentifierPattern = /^[a-z][a-z0-9_]{0,62}$/;
      if (!postgresIdentifierPattern.test(dbName)) {
        showNotification('数据库名只能使用小写字母、数字和下划线，并以字母开头', 'error');
        dbNameInput.focus();
        return;
      }
      if (!postgresIdentifierPattern.test(dbUser)) {
        showNotification('数据库用户名只能使用小写字母、数字和下划线，并以字母开头', 'error');
        dbUserInput.focus();
        return;
      }

      var dbHost = '';
      var dbPort = 5432;
      var dbSslmode = '';
      if (isExternal) {
        dbHost = dbHostInput ? dbHostInput.value.trim() : '';
        if (!isValidDbHost(dbHost)) {
          showNotification('请填写有效的数据库主机（IP / 主机名 / host.docker.internal）', 'error');
          if (dbHostInput) dbHostInput.focus();
          return;
        }
        dbPort = parseInt(dbPortInput && dbPortInput.value, 10);
        if (!dbPort || dbPort < 1 || dbPort > 65535) {
          showNotification('数据库端口无效', 'error');
          if (dbPortInput) dbPortInput.focus();
          return;
        }
        dbSslmode = dbSslmodeSelect ? (dbSslmodeSelect.value || '').trim() : '';
        if (!SSLMODE_ALLOWED[dbSslmode]) {
          showNotification('sslmode 无效', 'error');
          if (dbSslmodeSelect) dbSslmodeSelect.focus();
          return;
        }
        // 附加外部子网可选：非空时须为合法 Docker 网络名
        var dbExtraNetwork = (dbExtraNetworkInput && dbExtraNetworkInput.value.trim()) || '';
        if (dbExtraNetwork && !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(dbExtraNetwork)) {
          showNotification('附加子网不是合法 Docker 网络名', 'error');
          if (dbExtraNetworkInput) dbExtraNetworkInput.focus();
          return;
        }
        state.dbExtraNetwork = dbExtraNetwork;
        // External: keep user password as-is (URL-encoded when building DATABASE_URL)
        if (!dbPassword) {
          showNotification('请填写外置数据库密码', 'error');
          dbPasswordInput.focus();
          return;
        }
      } else {
        // Bundled: 密钥不足时当场补齐；白名单字符，禁止 .env 注入
        if (!dbPassword || dbPassword.length < 32) {
          dbPassword = generatePassword();
          dbPasswordInput.value = dbPassword;
        }
        try {
          requireSafeDotenvToken(dbPassword, '数据库密码');
        } catch (tokenErr) {
          showNotification(tokenErr.message, 'error');
          dbPasswordInput.focus();
          return;
        }
      }

      // 长度不足才自动生成；长度足够时必须通过白名单（禁换行/#/=/空白）
      if (!jwtSecret || jwtSecret.length < 32) {
        jwtSecret = generateJwtSecret();
        jwtSecretInput.value = jwtSecret;
      }
      if (!updateToken || updateToken.length < 32) {
        updateToken = generateUpdateToken();
        updateTokenInput.value = updateToken;
      }
      if (!gatewaySecret || gatewaySecret.length < 32) {
        gatewaySecret = generateUpdaterGatewaySecret();
        if (gatewaySecretInput) gatewaySecretInput.value = gatewaySecret;
      }
      if (!setupSecret || setupSecret.length < 32) {
        setupSecret = generateSetupSecret();
        if (setupSecretInput) setupSecretInput.value = setupSecret;
      }
      try {
        requireSafeDotenvToken(jwtSecret, 'JWT_SECRET');
        requireSafeDotenvToken(updateToken, 'UPDATE_TOKEN');
        requireSafeDotenvToken(gatewaySecret, 'UPDATER_GATEWAY_SECRET');
        requireSafeDotenvToken(setupSecret, 'MYRIAD_SETUP_SECRET');
      } catch (secErr) {
        showNotification(secErr.message, 'error');
        return;
      }

      state.mainDomain = mainDomain;
      state.extraDomain = extraDomain;
      state.dbPassword = dbPassword;
      state.jwtSecret = jwtSecret;
      state.updateToken = updateToken;
      state.updaterGatewaySecret = gatewaySecret;
      state.setupSecret = setupSecret;
      state.dbName = dbName;
      state.dbUser = dbUser;
      state.dbMode = dbMode;
      state.dbHost = dbHost;
      state.dbPort = dbPort;
      state.dbSslmode = dbSslmode;
      if (!isExternal) state.dbExtraNetwork = '';

      state.httpBindAddress = httpBindAddressSelect.value || '127.0.0.1';
      if (state.httpBindAddress !== '127.0.0.1' && state.httpBindAddress !== '0.0.0.0') {
        showNotification('HTTP 监听地址无效', 'error');
        httpBindAddressSelect.focus();
        return;
      }

      state.httpPort = parseInt(httpPortInput.value, 10) || 8080;
      if (state.httpPort < 1 || state.httpPort > 65535) {
        showNotification('HTTP 端口无效', 'error');
        httpPortInput.focus();
        return;
      }

      state.dbVersion = (dbVersionSelect && dbVersionSelect.value) ? dbVersionSelect.value.trim() : '18';
      if (!isExternal) {
        if (!isValidPgMajor(state.dbVersion)) {
          showNotification(
            'PostgreSQL 主版本须为 ' + PG_VERSION_MIN + '–' + PG_VERSION_MAX + ' 的整数（当前镜像线）',
            'error'
          );
          if (dbVersionSelect) dbVersionSelect.focus();
          return;
        }
      }

      // 若 tag 为空：等待进行中的拉取，或发起新拉取（不强制覆盖手改字段）
      var myriadTag = (myriadTagInput.value || '').trim();
      var proxyTag = (proxyTagInput.value || '').trim();
      var updaterTag = (updaterTagInput.value || '').trim();
      if (!myriadTag || !proxyTag || !updaterTag) {
        var resolved = await refreshLatestTags(tagInputs, channelSelect, { notify: false, force: false });
        if (!resolved && (!myriadTag || !proxyTag || !updaterTag)) {
          showNotification('镜像 tag 为空且无法自动获取，请点击「刷新最新版本」或手动填写', 'error');
          myriadTagInput.focus();
          return;
        }
        myriadTag = (myriadTagInput.value || '').trim();
        proxyTag = (proxyTagInput.value || '').trim();
        updaterTag = (updaterTagInput.value || '').trim();
      }

      state.myriadTag = myriadTag;
      state.proxyTag = proxyTag;
      state.updaterTag = updaterTag;
      state.channel = channelSelect.value || 'stable';
      state.cosignVerify = cosignSelect.value || 'strict';

      state.dbCpuLimit = (dbCpuLimitInput && dbCpuLimitInput.value.trim()) || '2.0';
      state.dbMemLimit = (dbMemLimitInput && dbMemLimitInput.value.trim()) || '2G';
      state.backendCpuLimit = backendCpuLimitInput.value.trim() || '2.0';
      state.backendMemLimit = backendMemLimitInput.value.trim() || '4G';
      state.frontendCpuLimit = frontendCpuLimitInput.value.trim() || '2.0';
      state.frontendMemLimit = frontendMemLimitInput.value.trim() || '2G';

      var cpuValues = isExternal
        ? [state.backendCpuLimit, state.frontendCpuLimit]
        : [state.dbCpuLimit, state.backendCpuLimit, state.frontendCpuLimit];
      if (cpuValues.some(function(value) { return !/^\d+(?:\.\d+)?$/.test(value) || Number(value) <= 0; })) {
        showNotification('CPU 数量必须是大于 0 的数字', 'error');
        return;
      }
      var memoryValues = isExternal
        ? [state.backendMemLimit, state.frontendMemLimit]
        : [state.dbMemLimit, state.backendMemLimit, state.frontendMemLimit];
      if (memoryValues.some(function(value) { return !isValidMemoryLimit(value); })) {
        showNotification(
          '内存须为 16M–256G（如 512M、2G）；禁止 0M 与超大值',
          'error'
        );
        return;
      }

      if (!state.myriadTag || !state.proxyTag || !state.updaterTag) {
        showNotification('请填写完整的镜像 tag', 'error');
        return;
      }

      var myriadRef = parseImageRef(state.myriadTag);
      var proxyRef = parseImageRef(state.proxyTag);
      var updaterRef = parseImageRef(state.updaterTag);
      if (!myriadRef || !proxyRef || !updaterRef) {
        showNotification(
          'tag 须为 versioned（vX.Y.Z / vX.Y.Z-rc.N），可选 @sha256:<64hex>；禁止 latest',
          'error'
        );
        return;
      }
      // 存纯 tag（compose 默认 :tag）；digest 单独进 state 供 pin
      state.myriadTag = myriadRef.tag;
      state.proxyTag = proxyRef.tag;
      state.updaterTag = updaterRef.tag;
      state.myriadDigest = myriadRef.digest;
      state.proxyDigest = proxyRef.digest;
      state.updaterDigest = updaterRef.digest;
      // 输入框保留用户原文（可含 digest）
      if (myriadTagInput) myriadTagInput.value = myriadRef.raw;
      if (proxyTagInput) proxyTagInput.value = proxyRef.raw;
      if (updaterTagInput) updaterTagInput.value = updaterRef.raw;

      var netMyriad = (netMyriadInput && netMyriadInput.value.trim()) || state.netMyriad || 'myriad-net';
      var netAdmin = (netAdminInput && netAdminInput.value.trim()) || state.netAdmin || 'myriad-admin-net';
      var netGuard = (netGuardInput && netGuardInput.value.trim()) || state.netGuard || 'myriad-docker-guard-net';
      var netEntries = [
        { key: 'MYRIAD_DOCKER_NETWORK', value: netMyriad },
        { key: 'MYRIAD_ADMIN_NETWORK', value: netAdmin },
        { key: 'MYRIAD_DOCKER_GUARD_NETWORK', value: netGuard }
      ];
      var netNameRe = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
      for (var netIdx = 0; netIdx < netEntries.length; netIdx++) {
        var netEntry = netEntries[netIdx];
        if (!netEntry.value) {
          showNotification(netEntry.key + ' 不能为空', 'error');
          return;
        }
        if (!netNameRe.test(netEntry.value)) {
          showNotification(
            netEntry.key + ' 不是合法 Docker 网络名',
            'error'
          );
          return;
        }
      }
      // 互斥校验：三个内部子网名两两不同；附加外部子网不得与之撞名
      var extraNetName = (state.dbExtraNetwork || '').trim();
      var seen = {};
      for (var exclIdx = 0; exclIdx < netEntries.length; exclIdx++) {
        var entry = netEntries[exclIdx];
        var prevKey = seen[entry.value];
        if (prevKey) {
          showNotification(
            prevKey + ' 与 ' + entry.key + ' 使用了相同的 Docker 网络名「' + entry.value + '」' +
            '，请改为互不相同',
            'error'
          );
          return;
        }
        seen[entry.value] = entry.key;
        if (extraNetName && extraNetName === entry.value) {
          showNotification(
            entry.key + ' 与「为 backend 附加 docker 子网」使用了相同的网络名「' + extraNetName + '」' +
            '，两者必须不同',
            'error'
          );
          return;
        }
      }
      state.netMyriad = netMyriad;
      state.netAdmin = netAdmin;
      state.netGuard = netGuard;

      try {
        generateConfigs();
      } catch (err) {
        showNotification((err && err.message) ? err.message : '生成失败', 'error');
      }
    } finally {
      generateAllBtn.disabled = false;
    }
  });

  document.querySelectorAll('.btn-copy').forEach(function(btn) {
    pageListen(btn, 'click', function() {
      var target = btn.getAttribute('data-target');
      var content = document.getElementById('result-' + target).textContent;
      copyToClipboard(content, btn);
    });
  });

  document.querySelectorAll('.btn-download').forEach(function(btn) {
    pageListen(btn, 'click', function() {
      var target = btn.getAttribute('data-target');
      var content = document.getElementById('result-' + target).textContent;
      var filename = btn.getAttribute('data-filename');

      if (target === 'main-nginx') {
        filename = state.mainDomain + '.conf';
      } else if (target === 'extra-nginx') {
        filename = (state.extraDomain || 'extra') + '.conf';
      }

      downloadFile(content, filename);
    });
  });

  // 自定义下拉（系统 option 列表无法按主题着色）
  enhanceAllSelects();

  // 自动生成密钥
  genDbPasswordBtn.click();
  genJwtSecretBtn.click();
  genUpdateTokenBtn.click();
  if (genGatewaySecretBtn) genGatewaySecretBtn.click();

  // 启动时解析 Docker Hub 最新 versioned tag（不写死版本号）
  refreshLatestTags(tagInputs, channelSelect, { notify: false });
}

function pageListen(target, event, handler, options) {
  if (!target || typeof target.addEventListener !== 'function') return;
  target.addEventListener(event, handler, options);
  pageLifecycle.unsubs.push(function () {
    try {
      target.removeEventListener(event, handler, options);
    } catch (e) { /* ignore */ }
  });
}

function setupFileUpload(uploadBox, fileInput, onLoad, onClear) {
  if (!uploadBox || !fileInput) return;

  pageListen(uploadBox, 'click', function(e) {
    if (e.target.classList.contains('btn-remove')) {
      return;
    }
    fileInput.click();
  });

  pageListen(fileInput, 'change', function() {
    if (fileInput.files.length > 0) {
      readNginxUpload(fileInput.files[0], onLoad);
    }
  });

  pageListen(uploadBox, 'dragover', function(e) {
    e.preventDefault();
    uploadBox.classList.add('dragover');
  });

  pageListen(uploadBox, 'dragleave', function() {
    uploadBox.classList.remove('dragover');
  });

  pageListen(uploadBox, 'drop', function(e) {
    e.preventDefault();
    uploadBox.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      readNginxUpload(e.dataTransfer.files[0], onLoad);
    }
  });

  var removeBtn = uploadBox.querySelector('.btn-remove');
  if (removeBtn) {
    pageListen(removeBtn, 'click', function(e) {
      e.stopPropagation();
      hideUploadSuccess(uploadBox);
      fileInput.value = '';
      if (typeof onClear === 'function') onClear();
    });
  }
}

function isAllowedNginxFile(file) {
  if (!file) return false;
  var name = String(file.name || '');
  if (/\.conf$/i.test(name)) return true;
  var t = String(file.type || '');
  if (!t || t === 'application/octet-stream') return /\.(conf|txt|nginx)$/i.test(name);
  return /^text\//i.test(t) || t === 'application/x-nginx-conf';
}

function readNginxUpload(file, callback) {
  if (!file) return;
  if (file.size > NGINX_UPLOAD_MAX_BYTES) {
    showNotification(
      'Nginx 配置不能超过 ' + Math.floor(NGINX_UPLOAD_MAX_BYTES / 1024) + 'KB（当前 ' +
      Math.ceil(file.size / 1024) + 'KB）',
      'error'
    );
    return;
  }
  if (!isAllowedNginxFile(file)) {
    showNotification('请上传 .conf 文本文件', 'error');
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    var text = e.target.result;
    if (typeof text !== 'string') {
      showNotification('无法以文本读取文件', 'error');
      return;
    }
    if (text.indexOf('\0') !== -1) {
      showNotification('拒绝含 NUL 的二进制文件', 'error');
      return;
    }
    if (text.length > NGINX_UPLOAD_MAX_BYTES) {
      showNotification('文件内容超过大小上限', 'error');
      return;
    }
    callback(text, file.name);
  };
  reader.onerror = function() {
    showNotification('读取文件失败', 'error');
  };
  reader.readAsText(file);
}

function showUploadSuccess(uploadBox, fileName) {
  var placeholder = uploadBox.querySelector('.upload-placeholder');
  var success = uploadBox.querySelector('.upload-success');
  var fileNameEl = success.querySelector('.file-name');

  placeholder.hidden = true;
  success.hidden = false;
  fileNameEl.textContent = fileName;
}

function hideUploadSuccess(uploadBox) {
  var placeholder = uploadBox.querySelector('.upload-placeholder');
  var success = uploadBox.querySelector('.upload-success');

  placeholder.hidden = false;
  success.hidden = true;
}

function animateButton(btn) {
  btn.style.transform = 'rotate(180deg)';
  setTimeout(function() {
    btn.style.transform = '';
  }, 300);
}

// ========================================
// 生成配置
// ========================================

function applyPlaceholders(template, map) {
  var out = template;
  Object.keys(map).forEach(function(key) {
    var re = new RegExp('\\{\\{' + key + '\\}\\}', 'g');
    // Function replacer: avoid $ special sequences in passwords / URLs
    var value = map[key] == null ? '' : String(map[key]);
    out = out.replace(re, function() { return value; });
  });
  return out;
}

function generateConfigs() {
  var corsOrigins = buildCorsOrigins(state.mainDomain, state.extraDomain);
  var isExternal = state.dbMode === 'external';
  var panelId = state.panelId || '1panel';
  var panel = getPanelProfile(panelId);


  var databaseUrl;
  if (isExternal) {
    databaseUrl = buildDatabaseUrl({
      user: state.dbUser,
      password: state.dbPassword,
      host: state.dbHost,
      port: state.dbPort,
      database: state.dbName,
      sslmode: state.dbSslmode
    });
  } else {
    databaseUrl = buildDatabaseUrl({
      user: state.dbUser,
      password: state.dbPassword,
      host: 'postgres',
      port: 5432,
      database: state.dbName,
      sslmode: ''
    });
  }

  var cosignInsecureHint = state.cosignVerify === 'off'
    ? 'UPDATER_ALLOW_INSECURE_COSIGN=true'
    : '# UPDATER_ALLOW_INSECURE_COSIGN=true\n# COSIGN_INSECURE_OK=true';

  var postgresService = '';
  var backendDependsOn = '      backend-volume-init: { condition: service_completed_successfully }\n';
  var dockerGuardExtra = '';
  var updaterPgdataLine = '';
  var composeStartHint = 'mkdir -p state backups && docker compose up -d';
  var postgresEnvBlock = '';
  var deployNetMembers = 'proxy, frontend, backend';
  var deployMkdir = 'mkdir -p state backups';
  var deployDataSection =
    '## 数据\n\n' +
    '`MYRIAD_DB_MODE=external`：不使用 `./pgdata`，Myriad updater **不会** 快照外置数据库。\n' +
    '备份与恢复由你自行负责（面板备份、托管 PG 快照、`pg_dump` 等）。\n' +
    '容器访问宿主机/外置库时，主机可能需填 IP、`host.docker.internal` 或 docker bridge 网关。\n';

  if (!isExternal) {
    postgresService = applyPlaceholders(POSTGRES_SERVICE_TEMPLATE, {
      DB_VERSION: state.dbVersion,
      DB_CPU_LIMIT: state.dbCpuLimit,
      DB_MEM_LIMIT: state.dbMemLimit
    });
    backendDependsOn =
      '      postgres: { condition: service_healthy }\n' +
      '      backend-volume-init: { condition: service_completed_successfully }\n';
    dockerGuardExtra = ',postgres';
    updaterPgdataLine = '      UPDATER_PGDATA: /host/compose/pgdata\n';
    composeStartHint =
      'mkdir -p pgdata state backups && chown -R 70:70 pgdata && chmod 700 pgdata && docker compose up -d';
    postgresEnvBlock =
      'POSTGRES_DB=' + state.dbName + '\n' +
      'POSTGRES_USER=' + state.dbUser + '\n' +
      'POSTGRES_PASSWORD=' + state.dbPassword + '\n';
    deployNetMembers = 'proxy, frontend, backend, postgres';
    // alpine postgres 镜像系统用户 uid 70；面板文件管理创建目录常为 root → 必须 chown
    deployMkdir =
      'mkdir -p pgdata state backups\n' +
      'chown -R 70:70 pgdata\n' +
      'chmod 700 pgdata';
    deployDataSection =
      '## 数据\n\n' +
      '`./pgdata` bind mount → `/var/lib/postgresql`（PG18+；`MYRIAD_DB_MODE=bundled`）。\n' +
      '官方 `postgres:*-alpine` 数据目录须为 **uid 70** 可写；宝塔等用 root 建目录时务必 `chown -R 70:70 pgdata`。\n' +
      '换 PG 大版本前先 dump/restore。\n';
  } else {
    // Still document credentials used to build DATABASE_URL (optional for operators)
    postgresEnvBlock =
      '# Credentials used to build DATABASE_URL (external DB; no compose postgres service)\n' +
      '# POSTGRES_DB=' + state.dbName + '\n' +
      '# POSTGRES_USER=' + state.dbUser + '\n';
  }

  var extraNetworkName = isExternal ? (state.dbExtraNetwork || '').trim() : '';
  var backendExtraNetworkRef = extraNetworkName ? ', myriad-backend-ext' : '';
  var extraNetworkDecl = extraNetworkName
    ? '  myriad-backend-ext:\n    external: true\n    name: ${MYRIAD_BACKEND_EXTRA_NETWORK}\n'
    : '';
  var backendExtraNetworkLine = extraNetworkName
    ? 'MYRIAD_BACKEND_EXTRA_NETWORK=' + extraNetworkName + '\n'
    : '';

  var map = {
    MYRIAD_DB_MODE: isExternal ? 'external' : 'bundled',
    COMPOSE_START_HINT: composeStartHint,
    POSTGRES_SERVICE: postgresService,
    BACKEND_DEPENDS_ON: backendDependsOn,
    DOCKER_GUARD_EXTRA_IMAGES: dockerGuardExtra,
    UPDATER_PGDATA_LINE: updaterPgdataLine,
    POSTGRES_ENV_BLOCK: postgresEnvBlock,
    DEPLOY_NET_MEMBERS: deployNetMembers,
    DEPLOY_MKDIR: deployMkdir,
    DEPLOY_DATA_SECTION: deployDataSection,
    DB_VERSION: state.dbVersion,
    POSTGRES_DB: state.dbName,
    POSTGRES_USER: state.dbUser,
    DB_CPU_LIMIT: state.dbCpuLimit,
    DB_MEM_LIMIT: state.dbMemLimit,
    BACKEND_CPU_LIMIT: state.backendCpuLimit,
    BACKEND_MEM_LIMIT: state.backendMemLimit,
    FRONTEND_CPU_LIMIT: state.frontendCpuLimit,
    FRONTEND_MEM_LIMIT: state.frontendMemLimit,
    POSTGRES_PASSWORD: state.dbPassword,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: state.jwtSecret,
    UPDATE_TOKEN: state.updateToken,
    UPDATER_GATEWAY_SECRET: state.updaterGatewaySecret,
    MYRIAD_SETUP_SECRET: state.setupSecret,
    MAIN_DOMAIN: state.mainDomain,
    EXTRA_DOMAIN: state.extraDomain || '',
    CORS_ORIGINS: corsOrigins,
    HTTP_BIND_ADDRESS: state.httpBindAddress,
    HTTP_PORT: String(state.httpPort),
    MYRIAD_DOCKER_NETWORK: state.netMyriad || 'myriad-net',
    MYRIAD_ADMIN_NETWORK: state.netAdmin || 'myriad-admin-net',
    MYRIAD_DOCKER_GUARD_NETWORK: state.netGuard || 'myriad-docker-guard-net',
    BACKEND_EXTRA_NETWORK_REF: backendExtraNetworkRef,
    EXTRA_NETWORK_DECL: extraNetworkDecl,
    BACKEND_EXTRA_NETWORK_LINE: backendExtraNetworkLine,
    MYRIAD_TAG: state.myriadTag,
    PROXY_TAG: state.proxyTag,
    UPDATER_TAG: state.updaterTag,
    CHANNEL: state.channel,
    COSIGN_VERIFY: state.cosignVerify,
    COSIGN_INSECURE_HINT: cosignInsecureHint,
    PANEL_LABEL: panel.label,
    PANEL_DEPLOY_SECTION: buildPanelDeploySection(
      panelId,
      state.mainDomain,
      state.httpBindAddress,
      state.httpPort,
      isExternal
    ),
    SITE_ROOT: panel.siteRoot(state.mainDomain),
    ACCESS_LOG: panel.accessLog(state.mainDomain),
    ERROR_LOG: panel.errorLog(state.mainDomain),
    ACME_ROOT: panel.acmeRoot(state.mainDomain),
    ACME_COMMENT: panel.acmeComment,
    EXTRA_SITE_ROOT: state.extraDomain ? panel.siteRoot(state.extraDomain) : '',
    EXTRA_ACCESS_LOG: state.extraDomain ? panel.accessLog(state.extraDomain) : '',
    EXTRA_ERROR_LOG: state.extraDomain ? panel.errorLog(state.extraDomain) : '',
    EXTRA_ACME_ROOT: state.extraDomain ? panel.acmeRoot(state.extraDomain) : ''
  };

  var dockerCompose = applyPlaceholders(DOCKER_COMPOSE_TEMPLATE, map);
  var envFile = applyPlaceholders(ENV_TEMPLATE, map);
  var deployNotes = applyPlaceholders(DEPLOY_NOTES_TEMPLATE, map);

  // 可选 digest pin：将 image: ${X_IMAGE:-repo}:tag 换成完整 @sha256 引用
  function pinComposeImage(composeText, envVar, repoDefault, tag, digest) {
    if (!digest) return composeText;
    var full = buildImageRef(repoDefault, tag, digest);
    // 匹配 compose 模板中的 ${ENV:-default}:${TAGVAR}
    var re = new RegExp(
      'image:\\s*\\$\\{' + envVar + ':-[^}]+\\}:\\$\\{' +
      (envVar === 'BACKEND_IMAGE' || envVar === 'FRONTEND_IMAGE' ? 'MYRIAD_TAG' :
        envVar === 'PROXY_IMAGE' ? 'PROXY_TAG' : 'UPDATER_TAG') +
      '\\}',
      'g'
    );
    return composeText.replace(re, 'image: ' + full);
  }
  dockerCompose = pinComposeImage(
    dockerCompose, 'BACKEND_IMAGE',
    'docker.io/somekawahitomi/myriad-backend', state.myriadTag, state.myriadDigest
  );
  dockerCompose = pinComposeImage(
    dockerCompose, 'FRONTEND_IMAGE',
    'docker.io/somekawahitomi/myriad-frontend', state.myriadTag, state.myriadDigest
  );
  dockerCompose = pinComposeImage(
    dockerCompose, 'PROXY_IMAGE',
    'docker.io/somekawahitomi/myriad-proxy', state.proxyTag, state.proxyDigest
  );
  dockerCompose = pinComposeImage(
    dockerCompose, 'UPDATER_IMAGE',
    'docker.io/somekawahitomi/myriad-updater', state.updaterTag, state.updaterDigest
  );

  // .env 自检：密钥白名单 + 键集合 + 无注入行
  validateGeneratedEnv(envFile, {
    JWT_SECRET: state.jwtSecret,
    UPDATE_TOKEN: state.updateToken,
    UPDATER_GATEWAY_SECRET: state.updaterGatewaySecret,
    MYRIAD_SETUP_SECRET: state.setupSecret,
    POSTGRES_PASSWORD: isExternal ? undefined : state.dbPassword
  }, { bundled: !isExternal });

  // 主域名 Nginx
  var mainNginxBefore = state.nginxConfig || '';
  var mainNginx;
  if (state.nginxConfig) {
    mainNginx = replaceNginxDomain(state.nginxConfig, state.mainDomain);
    mainNginx = replaceNginxUpstreamToProxy(mainNginx, state.httpPort, state.mainDomain, panelId);
  } else {
    mainNginx = applyPlaceholders(DEFAULT_NGINX_TEMPLATE, map);
  }

  // 额外域名 Nginx（可选）
  var hasExtra = !!state.extraDomain;
  var extraNginx = '';
  var extraNginxBefore = state.extraNginxConfig || '';
  var cardExtra = document.getElementById('card-extra-nginx');
  if (hasExtra) {
    if (state.extraNginxConfig) {
      extraNginx = replaceNginxDomain(state.extraNginxConfig, state.extraDomain);
      extraNginx = replaceNginxUpstreamToProxy(extraNginx, state.httpPort, state.extraDomain, panelId);
    } else {
      extraNginx = applyPlaceholders(DEFAULT_EXTRA_NGINX_TEMPLATE, map);
    }
    if (cardExtra) cardExtra.hidden = false;
  } else if (cardExtra) {
    cardExtra.hidden = true;
  }

  // 结构化 diff / 校验摘要
  var nginxSummary = summarizeNginxDiff(mainNginxBefore || null, mainNginx, state.mainDomain);
  if (hasExtra) {
    nginxSummary = nginxSummary.concat(
      summarizeNginxDiff(extraNginxBefore || null, extraNginx, state.extraDomain)
    );
  }
  var verifyBlock = [
    '',
    '## 生成校验摘要',
    '',
    '- .env：密钥已通过 `[A-Za-z0-9_-]{32,512}` 白名单；再解析后键集合完整',
    '- Compose：请执行 `docker compose --env-file .env config`',
    '- Nginx：' + nginxSummary.join('；'),
    '- 命令：`nginx -t`（或容器内同命令）——手写解析器不能替代'
  ].join('\n');
  deployNotes = deployNotes + verifyBlock;

  document.getElementById('result-docker-compose').textContent = dockerCompose;
  document.getElementById('result-env').textContent = envFile;
  document.getElementById('result-main-nginx').textContent = mainNginx;
  document.getElementById('result-deploy-notes').textContent = deployNotes;

  var validationEl = document.getElementById('result-validation');
  if (validationEl) {
    validationEl.textContent = [
      '✓ .env 密钥白名单 + 再解析通过',
      '✓ PROXY_ALLOW_DIRECT_UPDATER=false（单次）',
      state.myriadDigest || state.proxyDigest || state.updaterDigest
        ? '✓ 已 pin 部分镜像 digest'
        : '· 镜像为可变 tag（可选 vX.Y.Z@sha256:…）',
      'Nginx: ' + nginxSummary.join('\n  '),
      '',
      'docker compose -f docker-compose.yml --env-file .env config',
      'nginx -t'
    ].join('\n');
  }

  // Panel-specific result chrome
  var resultsIntro = document.getElementById('results-intro');
  if (resultsIntro) resultsIntro.textContent = panel.resultsIntro;
  var envBadge = document.getElementById('badge-env');
  if (envBadge) envBadge.textContent = panel.envBadge;
  var composeBadge = document.getElementById('badge-compose');
  if (composeBadge) composeBadge.textContent = panel.composeBadge;
  var envCopyBtn = document.querySelector('.btn-copy[data-target="env"]');
  if (envCopyBtn) {
    var label = panel.envCopyLabel || '复制';
    envCopyBtn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>' +
      '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' +
      '</svg> ' + label;
  }

  var extraResult = document.getElementById('result-extra-nginx');
  if (extraResult) {
    extraResult.textContent = extraNginx;
  }

  document.getElementById('name-main-nginx').textContent = state.mainDomain + '.conf';
  var nameExtra = document.getElementById('name-extra-nginx');
  if (nameExtra && hasExtra) {
    nameExtra.textContent = state.extraDomain + '.conf';
  }

  var reminder = document.getElementById('setup-secret-reminder');
  var reminderValue = document.getElementById('setup-secret-reminder-value');
  if (reminder && reminderValue && state.setupSecret) {
    reminderValue.textContent = state.setupSecret;
    reminder.hidden = false;
  }

  var resultsSection = document.getElementById('results-section');
  resultsSection.hidden = false;
  resultsSection.scrollIntoView({ behavior: 'smooth' });

  showNotification('已生成。请先复制安装暗号，创建所有者时要填。', 'success');
}

// ========================================
// 通用工具
// ========================================

function copyToClipboard(text, btn) {
  var originalHTML = btn.innerHTML;

  function onSuccess() {
    btn.classList.add('copied');
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> 已复制';

    setTimeout(function() {
      btn.classList.remove('copied');
      btn.innerHTML = originalHTML;
    }, 2000);

    showNotification('已复制到剪贴板', 'success');
  }

  function onError(err) {
    console.error('复制失败:', err);
    showNotification('复制失败，请手动选择复制', 'error');
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(function() {
      fallbackCopy(text, onSuccess, onError);
    });
  } else {
    fallbackCopy(text, onSuccess, onError);
  }
}

function fallbackCopy(text, onSuccess, onError) {
  var textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.width = '2em';
  textArea.style.height = '2em';
  textArea.style.padding = '0';
  textArea.style.border = 'none';
  textArea.style.outline = 'none';
  textArea.style.boxShadow = 'none';
  textArea.style.background = 'transparent';
  textArea.style.opacity = '0';

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    var successful = document.execCommand('copy');
    if (successful) {
      onSuccess();
    } else {
      onError(new Error('execCommand 返回 false'));
    }
  } catch (err) {
    onError(err);
  }

  document.body.removeChild(textArea);
}

function downloadFile(content, filename) {
  if (typeof Tapp !== 'undefined' && Tapp.file && Tapp.file.download) {
    Tapp.file.download(content, filename, 'text/plain;charset=utf-8')
      .then(function() {
        showNotification('文件下载成功: ' + filename, 'success');
      })
      .catch(function(err) {
        console.error('Tapp.file.download 失败:', err);
        fallbackDownload(content, filename);
      });
  } else {
    fallbackDownload(content, filename);
  }
}

function fallbackDownload(content, filename) {
  var dataUrl = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);

  var a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.style.display = 'none';

  document.body.appendChild(a);
  a.click();

  setTimeout(function() {
    if (a.parentNode) {
      a.parentNode.removeChild(a);
    }
  }, 100);

  showNotification('文件下载已开始: ' + filename, 'success');
}

async function showNotification(message, type) {
  try {
    await Tapp.ui.showNotification({
      title: type === 'success' ? '成功' : type === 'error' ? '错误' : '提示',
      message: message,
      type: type || 'info'
    });
  } catch (e) {
    console.log('[ConfigGenerator]', message);
  }
}

// ========================================
// 自定义下拉：替换系统 <select> 的 option 菜单
// ========================================

var CHEVRON_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
var CHECK_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

function closeAllCustomSelects(exceptRoot) {
  document.querySelectorAll('.cg-select.is-open').forEach(function (root) {
    if (exceptRoot && root === exceptRoot) return;
    root.classList.remove('is-open');
    var menu = root.querySelector('.cg-select-menu');
    var trigger = root.querySelector('.cg-select-trigger');
    if (menu) menu.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  });
}

function syncCustomSelectLabel(root, select) {
  var label = root.querySelector('.cg-select-label');
  if (!label || !select) return;
  var opt = select.options[select.selectedIndex];
  var text = opt ? String(opt.textContent || '').trim() : '';
  if (!text && select.value === '') {
    label.textContent = '请选择';
    label.classList.add('is-placeholder');
  } else {
    label.textContent = text || select.value;
    label.classList.remove('is-placeholder');
  }
  root.querySelectorAll('.cg-select-option').forEach(function (btn) {
    var selected = btn.getAttribute('data-value') === select.value;
    btn.classList.toggle('is-selected', selected);
    btn.setAttribute('aria-selected', selected ? 'true' : 'false');
  });
}

function enhanceNativeSelect(select) {
  if (!select || select.dataset.cgEnhanced === '1') return;
  if (select.closest('.cg-select')) return;

  select.dataset.cgEnhanced = '1';
  select.classList.add('cg-select-native');

  var root = document.createElement('div');
  root.className = 'cg-select';
  root.dataset.selectId = select.id || '';

  var parent = select.parentNode;
  parent.insertBefore(root, select);
  root.appendChild(select);

  var trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'cg-select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  if (select.id) trigger.id = select.id + '-trigger';
  if (select.getAttribute('aria-labelledby')) {
    trigger.setAttribute('aria-labelledby', select.getAttribute('aria-labelledby'));
  } else if (select.id) {
    var lab = document.querySelector('label[for="' + select.id + '"]');
    if (lab && lab.id) trigger.setAttribute('aria-labelledby', lab.id);
  }

  var labelSpan = document.createElement('span');
  labelSpan.className = 'cg-select-label';
  var chevron = document.createElement('span');
  chevron.className = 'cg-select-chevron';
  chevron.innerHTML = CHEVRON_SVG;
  trigger.appendChild(labelSpan);
  trigger.appendChild(chevron);

  var menu = document.createElement('div');
  menu.className = 'cg-select-menu';
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  if (select.id) menu.id = select.id + '-menu';
  trigger.setAttribute('aria-controls', menu.id || '');

  function rebuildOptions() {
    menu.innerHTML = '';
    for (var i = 0; i < select.options.length; i++) {
      (function (opt, index) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cg-select-option';
        btn.setAttribute('role', 'option');
        btn.setAttribute('data-value', opt.value);
        btn.setAttribute('data-index', String(index));
        if (opt.disabled) {
          btn.disabled = true;
          btn.setAttribute('aria-disabled', 'true');
        }
        var text = document.createElement('span');
        text.textContent = opt.textContent;
        var check = document.createElement('span');
        check.className = 'cg-select-option-check';
        check.innerHTML = CHECK_SVG;
        btn.appendChild(text);
        btn.appendChild(check);
        pageListen(btn, 'click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (opt.disabled) return;
          select.selectedIndex = index;
          select.value = opt.value;
          // 触发原生 change，供已有监听
          try {
            select.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (err) {
            var ev = document.createEvent('Event');
            ev.initEvent('change', true, true);
            select.dispatchEvent(ev);
          }
          syncCustomSelectLabel(root, select);
          closeAllCustomSelects();
          trigger.focus();
        });
        pageListen(btn, 'mouseenter', function () {
          menu.querySelectorAll('.cg-select-option').forEach(function (el) {
            el.classList.remove('is-active');
          });
          btn.classList.add('is-active');
        });
        menu.appendChild(btn);
      })(select.options[i], i);
    }
    syncCustomSelectLabel(root, select);
  }

  function openMenu() {
    closeAllCustomSelects(root);
    rebuildOptions();
    root.classList.add('is-open');
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    var selected = menu.querySelector('.cg-select-option.is-selected');
    if (selected) {
      selected.classList.add('is-active');
      try { selected.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ }
    }
  }

  function toggleMenu(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (select.disabled) return;
    if (root.classList.contains('is-open')) {
      closeAllCustomSelects();
    } else {
      openMenu();
    }
  }

  pageListen(trigger, 'click', toggleMenu);
  pageListen(trigger, 'keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!root.classList.contains('is-open')) openMenu();
    } else if (e.key === 'Escape') {
      closeAllCustomSelects();
    }
  });

  pageListen(select, 'change', function () {
    syncCustomSelectLabel(root, select);
  });

  root.appendChild(trigger);
  root.appendChild(menu);
  rebuildOptions();
}

function enhanceAllSelects() {
  document.querySelectorAll('select.form-select').forEach(function (sel) {
    enhanceNativeSelect(sel);
  });
  // 点击外部关闭
  pageListen(document, 'click', function (e) {
    if (e.target && e.target.closest && e.target.closest('.cg-select')) return;
    closeAllCustomSelects();
  });
  pageListen(document, 'keydown', function (e) {
    if (e.key === 'Escape') closeAllCustomSelects();
  });
}

// ========================================
// 生命周期入口
// ========================================

(function() {
  var mode = window._TAPP_MODE;
  var hasHtml = window._TAPP_HAS_HTML;

  if (mode === 'page' || hasHtml) {
    if (typeof Tapp !== 'undefined' && Tapp.lifecycle && typeof Tapp.lifecycle.onReady === 'function') {
      Tapp.lifecycle.onReady(function() {
        initPage();
      });
      if (typeof Tapp.lifecycle.onUnload === 'function') {
        Tapp.lifecycle.onUnload(function() {
          disposePage();
        });
      } else if (typeof Tapp.lifecycle.onDestroy === 'function') {
        Tapp.lifecycle.onDestroy(function() {
          disposePage();
        });
      }
    } else {
      // 开发预览 / 无 Tapp 宿主
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPage, { once: true });
      } else {
        initPage();
      }
      window.addEventListener('pagehide', disposePage, { once: false });
    }
  }
})();
