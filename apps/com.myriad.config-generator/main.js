// Myriad Config Generator — 生产 compose / .env / Nginx

var DOCKER_COMPOSE_TEMPLATE = `# Myriad
# nets: myriad-net | myriad-admin-net | myriad-docker-guard-net(internal)
# mkdir -p pgdata state backups && docker compose up -d

services:
  postgres:
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

  backend-volume-init:
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
      postgres: { condition: service_healthy }
      backend-volume-init: { condition: service_completed_successfully }
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:1103/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    volumes:
      - backend_cache:/app/cache
      - backend_data:/app/data
    networks: [myriad-net, myriad-admin-net]
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
      DOCKER_GUARD_ALLOWED_IMAGES: \${BACKEND_IMAGE:-docker.io/somekawahitomi/myriad-backend},\${FRONTEND_IMAGE:-docker.io/somekawahitomi/myriad-frontend},\${PROXY_IMAGE:-docker.io/somekawahitomi/myriad-proxy},\${UPDATER_IMAGE:-docker.io/somekawahitomi/myriad-updater},postgres
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
      UPDATER_PGDATA: /host/compose/pgdata
      UPDATER_COMPOSE_DIR: /host/compose
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
`;

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
# MYRIAD_DOCKER_NETWORK=myriad-net
# MYRIAD_ADMIN_NETWORK=myriad-admin-net
# MYRIAD_DOCKER_GUARD_NETWORK=myriad-docker-guard-net

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
# PROXY_TRUSTED_UPSTREAMS: empty trusts private/loopback peers only (outer 1Panel/Nginx).
# Never set 0.0.0.0/0 (would trust forged X-Forwarded-* from anyone).
# PROXY_TRUSTED_UPSTREAMS=
PROXY_ALLOW_DIRECT_UPDATER=false

COSIGN_VERIFY={{COSIGN_VERIFY}}
{{COSIGN_INSECURE_HINT}}

POSTGRES_DB={{POSTGRES_DB}}
POSTGRES_USER={{POSTGRES_USER}}
POSTGRES_PASSWORD={{POSTGRES_PASSWORD}}
DATABASE_URL={{DATABASE_URL}}
JWT_SECRET={{JWT_SECRET}}

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
    access_log /www/sites/{{MAIN_DOMAIN}}/log/access.log main;
    error_log /www/sites/{{MAIN_DOMAIN}}/log/error.log;

    # ACME (1Panel/certbot): local root BEFORE catch-all. Other /.well-known/* via proxy.
    location ^~ /.well-known/acme-challenge/ {
        root /www/sites/{{MAIN_DOMAIN}}/index;
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
    root /www/sites/{{MAIN_DOMAIN}}/index;
    error_page 404 /404.html;
}
`;

var DEFAULT_EXTRA_NGINX_TEMPLATE = `server {
    listen 80;
    server_name {{EXTRA_DOMAIN}};

    index index.php index.html index.htm default.php default.htm default.html;
    access_log /www/sites/{{EXTRA_DOMAIN}}/log/access.log main;
    error_log /www/sites/{{EXTRA_DOMAIN}}/log/error.log;

    # ACME (1Panel/certbot): local root BEFORE catch-all. Other /.well-known/* via proxy.
    location ^~ /.well-known/acme-challenge/ {
        root /www/sites/{{EXTRA_DOMAIN}}/index;
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
    root /www/sites/{{EXTRA_DOMAIN}}/index;
    error_page 404 /404.html;
}
`;

// 部署说明（生成结果中的文本卡片）
var DEPLOY_NOTES_TEMPLATE = `# Myriad 部署

同目录：\`docker-compose.yml\` + \`.env\`（\`chmod 600\`，勿提交）。

## 网络

| 网络 | 成员 |
|------|------|
| myriad-net | proxy, frontend, backend, postgres |
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

## 1Panel

编排贴 YAML；环境变量贴 \`.env\`；启动。站点反代到 proxy 端口，勿改成仅 /api。

## 启动

\`\`\`bash
mkdir -p pgdata state backups
chmod 600 .env
docker compose pull && docker compose up -d
\`\`\`

\`backend-volume-init\` 会在 backend 启动前修复持久卷权限；无需手工 chown。

可选：\`scripts/docker/deploy.sh up\`（含环境初始化与部署检查）。

## HTTPS

https://{{MAIN_DOMAIN}} → \`{{HTTP_BIND_ADDRESS}}:{{HTTP_PORT}}\`（整站反代）

## 更新

设置 → 关于 → 更新管理 · \`{{CHANNEL}}\` · cosign \`{{COSIGN_VERIFY}}\`

proxy 有 AP 路由变更时需单独 bump \`PROXY_TAG\`（与 \`MYRIAD_TAG\` 独立）。

\`DOCKER_GUARD_ALLOWED_IMAGES\` 必须包含 proxy（默认 \`myriad-proxy\`）；否则 product/proxy 更新会 403。已部署栈若曾漏掉 proxy：编辑 compose 补上后执行 \`docker compose up -d --force-recreate docker-guard\`，再重试更新。

## 数据

\`./pgdata\` bind mount。换 PG 大版本前先 dump/restore。

## 救援

\`\`\`bash
docker exec myriad-updater myriad-rescue status
docker exec myriad-updater myriad-rescue exit-maintenance --force
\`\`\`

临时直连：\`PROXY_ALLOW_DIRECT_UPDATER=true\`。

## 版本

MYRIAD_TAG={{MYRIAD_TAG}} · PROXY_TAG={{PROXY_TAG}} · UPDATER_TAG={{UPDATER_TAG}}  
禁止 \`:latest\`。
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

// 替换 Nginx 配置中的域名（含宝塔路径与常见 Let's Encrypt 路径）
function replaceNginxDomain(config, newDomain) {
  var oldDomain = extractDomain(config);

  config = config.replace(/server_name\s+([^;]+);/g, function(directive, namesText) {
    var names = namesText.trim().split(/\s+/);
    if (!oldDomain || names.indexOf(oldDomain) === -1) return directive;
    return 'server_name ' + newDomain + ';';
  });

  // 宝塔 / 1Panel 常见站点目录
  if (oldDomain) {
    var domainRegex = new RegExp('/www/sites/' + escapeRegExp(oldDomain) + '/', 'g');
    config = config.replace(domainRegex, '/www/sites/' + newDomain + '/');
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
  // 并行拉取，减少打开页到可生成的等待时间
  var results = await Promise.all([
    fetchDockerHubTags(DOCKER_REPOS.backend),
    fetchDockerHubTags(DOCKER_REPOS.frontend),
    fetchDockerHubTags(DOCKER_REPOS.proxy),
    fetchDockerHubTags(DOCKER_REPOS.updater)
  ]);
  var backendTags = results[0];
  var frontendTags = results[1];
  var proxyTags = results[2];
  var updaterTags = results[3];

  var myriadTag = pickLatestCommonVersionedTag([backendTags, frontendTags]);
  // 若 backend/frontend 暂无交集，分别取最新再优先 backend
  if (!myriadTag) {
    myriadTag = pickLatestVersionedTag(backendTags) || pickLatestVersionedTag(frontendTags);
  }
  var proxyTag = pickLatestVersionedTag(proxyTags) || myriadTag;
  var updaterTag = pickLatestVersionedTag(updaterTags) || myriadTag;

  if (!myriadTag && !proxyTag && !updaterTag) {
    throw new Error('Docker Hub 上未找到可用的 versioned tag（vX.Y.Z）');
  }

  return {
    myriadTag: myriadTag || '',
    proxyTag: proxyTag || '',
    updaterTag: updaterTag || '',
    backendCount: backendTags.length,
    frontendCount: frontendTags.length,
    proxyCount: proxyTags.length,
    updaterCount: updaterTags.length
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
      setTagStatus(
        '已解析最新版本：MYRIAD=' + resolved.myriadTag +
        ' · PROXY=' + resolved.proxyTag +
        ' · UPDATER=' + resolved.updaterTag +
        '（禁止 :latest）',
        'ok'
      );
      if (opts.notify) {
        showNotification('已更新为 Docker Hub 最新 versioned tag', 'success');
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

function extractNginxRoot(serverConfig, domain) {
  var match = serverConfig.match(/(?:^|\n)[ \t]*root\s+([^;]+);/);
  if (match) return match[1].trim();
  if (domain) return '/www/sites/' + domain + '/index';
  return '/www/sites/default/index';
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
function ensureAcmeChallengeLocation(serverConfig, domain, serverIndent) {
  if (hasAcmeChallengeLocation(serverConfig)) return serverConfig;

  var childIndent = serverIndent + '    ';
  var acmeBlock = buildAcmeChallengeLocation(extractNginxRoot(serverConfig, domain), childIndent);
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

function transformServerBlock(serverConfig, httpPort, serverIndent, domain) {
  var childIndent = serverIndent + '    ';
  var proxyLocation = buildNginxProxyLocation(httpPort, childIndent);
  var proxyInclude = /^[ \t]*include\s+[^;\n]*\/proxy\/\*\.conf\s*;[ \t]*$/gm;
  var replacedRoot = replaceRootLocation(serverConfig, httpPort);
  var next = serverConfig;

  if (replacedRoot !== null) {
    // Myriad 独占根路径（整站反代，非 /api-only）；移除 1Panel 外置代理入口，避免重复 location /。
    next = replacedRoot.replace(proxyInclude, '');
  } else if (proxyInclude.test(serverConfig)) {
    proxyInclude.lastIndex = 0;
    // Replace 1Panel proxy include with whole-site location / (keeps federation paths).
    next = serverConfig.replace(proxyInclude, proxyLocation);
  } else {
    var closeBrace = serverConfig.lastIndexOf('}');
    next = serverConfig.slice(0, closeBrace).replace(/[ \t]*$/, '') +
      '\n\n' + proxyLocation + '\n' + serverConfig.slice(closeBrace);
  }

  return ensureAcmeChallengeLocation(next, domain, serverIndent);
}

// 将上传的站点配置规范化为 Myriad proxy 整站入口（非 /api-only）。
// 支持同一站点常见的 HTTP 跳转块 + HTTPS 服务块，不修改其他域名。
function replaceNginxUpstreamToProxy(config, httpPort, domain) {
  var blocks = findServerBlocks(config);
  var replacements = blocks.filter(function(block) {
    return serverHasDomain(block.text, domain) && !isRedirectOnlyServer(block.text);
  }).map(function(block) {
    return {
      start: block.start,
      end: block.end,
      text: transformServerBlock(block.text, httpPort, block.indent, domain)
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
  nginxConfig: null,
  nginxFileName: '',
  extraNginxConfig: null,
  extraNginxFileName: '',
  httpBindAddress: '127.0.0.1',
  httpPort: 8080,
  dbVersion: '18',
  dbName: 'myriad',
  dbUser: 'myriad',
  dbCpuLimit: '2.0',
  dbMemLimit: '2G',
  // 运行时由 Docker Hub 解析填充，不在源码中写死版本
  myriadTag: '',
  proxyTag: '',
  updaterTag: '',
  channel: 'stable',
  cosignVerify: 'strict',
  // PostgreSQL / backend / frontend 可按宿主机条件限制
  backendCpuLimit: '2.0',
  backendMemLimit: '4G',
  frontendCpuLimit: '2.0',
  frontendMemLimit: '2G'
};

// ========================================
// UI 交互
// ========================================

function initPage() {
  var mainDomainInput = document.getElementById('main-domain');
  var extraDomainInput = document.getElementById('extra-domain');
  var dbPasswordInput = document.getElementById('db-password');
  var jwtSecretInput = document.getElementById('jwt-secret');
  var updateTokenInput = document.getElementById('update-token');
  var gatewaySecretInput = document.getElementById('updater-gateway-secret');
  var dbNameInput = document.getElementById('db-name');
  var dbUserInput = document.getElementById('db-user');

  var genDbPasswordBtn = document.getElementById('gen-db-password');
  var genJwtSecretBtn = document.getElementById('gen-jwt-secret');
  var genUpdateTokenBtn = document.getElementById('gen-update-token');
  var genGatewaySecretBtn = document.getElementById('gen-updater-gateway-secret');
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
  var refreshTagsBtn = document.getElementById('btn-refresh-tags');

  var tagInputs = {
    myriad: myriadTagInput,
    proxy: proxyTagInput,
    updater: updaterTagInput
  };

  function markTagManual(input) {
    if (!input) return;
    input.dataset.autoFilled = 'false';
  }

  [myriadTagInput, proxyTagInput, updaterTagInput].forEach(function(input) {
    if (!input) return;
    input.addEventListener('input', function() {
      markTagManual(input);
    });
  });

  if (channelSelect) {
    channelSelect.addEventListener('change', function() {
      tagFetchState.channelTouched = true;
    });
  }

  genDbPasswordBtn.addEventListener('click', function() {
    dbPasswordInput.value = generatePassword();
    animateButton(genDbPasswordBtn);
  });

  genJwtSecretBtn.addEventListener('click', function() {
    jwtSecretInput.value = generateJwtSecret();
    animateButton(genJwtSecretBtn);
  });

  genUpdateTokenBtn.addEventListener('click', function() {
    updateTokenInput.value = generateUpdateToken();
    animateButton(genUpdateTokenBtn);
  });

  if (genGatewaySecretBtn && gatewaySecretInput) {
    genGatewaySecretBtn.addEventListener('click', function() {
      gatewaySecretInput.value = generateUpdaterGatewaySecret();
      animateButton(genGatewaySecretBtn);
    });
  }

  if (refreshTagsBtn) {
    refreshTagsBtn.addEventListener('click', function() {
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

  generateAllBtn.addEventListener('click', async function() {
    if (generateAllBtn.disabled) return;
    generateAllBtn.disabled = true;

    try {
      var mainDomain = normalizeDomain(mainDomainInput.value);
      var extraDomain = normalizeDomain(extraDomainInput.value || '');
      var dbPassword = dbPasswordInput.value.trim();
      var jwtSecret = jwtSecretInput.value.trim();
      var updateToken = updateTokenInput.value.trim();
      var gatewaySecret = gatewaySecretInput ? gatewaySecretInput.value.trim() : '';
      var dbName = dbNameInput.value.trim();
      var dbUser = dbUserInput.value.trim();

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

      // 密钥不足时当场补齐并继续，避免「生成后还要再点一次」
      if (!dbPassword || dbPassword.length < 32) {
        dbPassword = generatePassword();
        dbPasswordInput.value = dbPassword;
      }
      if (!/^[A-Za-z0-9_-]{32,}$/.test(dbPassword)) {
        showNotification('数据库密码至少 32 位，只能使用字母、数字、下划线和连字符', 'error');
        dbPasswordInput.focus();
        return;
      }
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

      state.mainDomain = mainDomain;
      state.extraDomain = extraDomain;
      state.dbPassword = dbPassword;
      state.jwtSecret = jwtSecret;
      state.updateToken = updateToken;
      state.updaterGatewaySecret = gatewaySecret;
      state.dbName = dbName;
      state.dbUser = dbUser;

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

      state.dbVersion = (dbVersionSelect.value || '18').trim();
      if (!/^\d+$/.test(state.dbVersion) || Number(state.dbVersion) < 18) {
        showNotification('PostgreSQL 版本必须是 18 或更高的正式主版本', 'error');
        dbVersionSelect.focus();
        return;
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

      state.dbCpuLimit = dbCpuLimitInput.value.trim() || '2.0';
      state.dbMemLimit = dbMemLimitInput.value.trim() || '2G';
      state.backendCpuLimit = backendCpuLimitInput.value.trim() || '2.0';
      state.backendMemLimit = backendMemLimitInput.value.trim() || '4G';
      state.frontendCpuLimit = frontendCpuLimitInput.value.trim() || '2.0';
      state.frontendMemLimit = frontendMemLimitInput.value.trim() || '2G';

      var cpuValues = [state.dbCpuLimit, state.backendCpuLimit, state.frontendCpuLimit];
      if (cpuValues.some(function(value) { return !/^\d+(?:\.\d+)?$/.test(value) || Number(value) <= 0; })) {
        showNotification('CPU 数量必须是大于 0 的数字', 'error');
        return;
      }
      var memoryValues = [state.dbMemLimit, state.backendMemLimit, state.frontendMemLimit];
      if (memoryValues.some(function(value) { return !/^\d+(?:\.\d+)?[KMGTP]i?B?$/i.test(value); })) {
        showNotification('内存格式无效，请使用 512M、2G 等格式', 'error');
        return;
      }

      if (!state.myriadTag || !state.proxyTag || !state.updaterTag) {
        showNotification('请填写完整的镜像 tag', 'error');
        return;
      }

      if (/^latest$/i.test(state.myriadTag) || /^latest$/i.test(state.proxyTag) || /^latest$/i.test(state.updaterTag)) {
        showNotification('禁止使用 :latest 标签。请使用 versioned tag，或点「刷新最新版本」', 'error');
        return;
      }

      if (!parseVersionTag(state.myriadTag) || !parseVersionTag(state.proxyTag) || !parseVersionTag(state.updaterTag)) {
        showNotification('tag 格式应为 vX.Y.Z 或 vX.Y.Z-rc.N 等 versioned 形式', 'error');
        return;
      }

      try {
        generateConfigs();
      } catch (err) {
        showNotification((err && err.message) ? err.message : 'Nginx 配置无法处理', 'error');
      }
    } finally {
      generateAllBtn.disabled = false;
    }
  });

  document.querySelectorAll('.btn-copy').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var target = btn.getAttribute('data-target');
      var content = document.getElementById('result-' + target).textContent;
      copyToClipboard(content, btn);
    });
  });

  document.querySelectorAll('.btn-download').forEach(function(btn) {
    btn.addEventListener('click', function() {
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

  // 自动生成密钥
  genDbPasswordBtn.click();
  genJwtSecretBtn.click();
  genUpdateTokenBtn.click();
  if (genGatewaySecretBtn) genGatewaySecretBtn.click();

  // 启动时解析 Docker Hub 最新 versioned tag（不写死版本号）
  refreshLatestTags(tagInputs, channelSelect, { notify: false });
}

function setupFileUpload(uploadBox, fileInput, onLoad, onClear) {
  if (!uploadBox || !fileInput) return;

  uploadBox.addEventListener('click', function(e) {
    if (e.target.classList.contains('btn-remove')) {
      return;
    }
    fileInput.click();
  });

  fileInput.addEventListener('change', function() {
    if (fileInput.files.length > 0) {
      readFile(fileInput.files[0], onLoad);
    }
  });

  uploadBox.addEventListener('dragover', function(e) {
    e.preventDefault();
    uploadBox.classList.add('dragover');
  });

  uploadBox.addEventListener('dragleave', function() {
    uploadBox.classList.remove('dragover');
  });

  uploadBox.addEventListener('drop', function(e) {
    e.preventDefault();
    uploadBox.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      readFile(e.dataTransfer.files[0], onLoad);
    }
  });

  var removeBtn = uploadBox.querySelector('.btn-remove');
  if (removeBtn) {
    removeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      hideUploadSuccess(uploadBox);
      fileInput.value = '';
      if (typeof onClear === 'function') onClear();
    });
  }
}

function readFile(file, callback) {
  var reader = new FileReader();
  reader.onload = function(e) {
    callback(e.target.result, file.name);
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
    out = out.replace(re, map[key]);
  });
  return out;
}

function generateConfigs() {
  var corsOrigins = buildCorsOrigins(state.mainDomain, state.extraDomain);
  var databaseUrl = 'postgres://' +
    encodeURIComponent(state.dbUser) + ':' +
    encodeURIComponent(state.dbPassword) +
    '@postgres:5432/' + encodeURIComponent(state.dbName);

  var cosignInsecureHint = state.cosignVerify === 'off'
    ? 'UPDATER_ALLOW_INSECURE_COSIGN=true'
    : '# UPDATER_ALLOW_INSECURE_COSIGN=true\n# COSIGN_INSECURE_OK=true';

  var map = {
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
    MAIN_DOMAIN: state.mainDomain,
    EXTRA_DOMAIN: state.extraDomain || '',
    CORS_ORIGINS: corsOrigins,
    HTTP_BIND_ADDRESS: state.httpBindAddress,
    HTTP_PORT: String(state.httpPort),
    MYRIAD_TAG: state.myriadTag,
    PROXY_TAG: state.proxyTag,
    UPDATER_TAG: state.updaterTag,
    CHANNEL: state.channel,
    COSIGN_VERIFY: state.cosignVerify,
    COSIGN_INSECURE_HINT: cosignInsecureHint
  };

  var dockerCompose = applyPlaceholders(DOCKER_COMPOSE_TEMPLATE, map);
  var envFile = applyPlaceholders(ENV_TEMPLATE, map);
  var deployNotes = applyPlaceholders(DEPLOY_NOTES_TEMPLATE, map);

  // 主域名 Nginx
  var mainNginx;
  if (state.nginxConfig) {
    mainNginx = replaceNginxDomain(state.nginxConfig, state.mainDomain);
    mainNginx = replaceNginxUpstreamToProxy(mainNginx, state.httpPort, state.mainDomain);
  } else {
    mainNginx = applyPlaceholders(DEFAULT_NGINX_TEMPLATE, map);
  }

  // 额外域名 Nginx（可选）
  var hasExtra = !!state.extraDomain;
  var extraNginx = '';
  var cardExtra = document.getElementById('card-extra-nginx');
  if (hasExtra) {
    if (state.extraNginxConfig) {
      extraNginx = replaceNginxDomain(state.extraNginxConfig, state.extraDomain);
      extraNginx = replaceNginxUpstreamToProxy(extraNginx, state.httpPort, state.extraDomain);
    } else {
      extraNginx = applyPlaceholders(DEFAULT_EXTRA_NGINX_TEMPLATE, map);
    }
    if (cardExtra) cardExtra.hidden = false;
  } else if (cardExtra) {
    cardExtra.hidden = true;
  }

  document.getElementById('result-docker-compose').textContent = dockerCompose;
  document.getElementById('result-env').textContent = envFile;
  document.getElementById('result-main-nginx').textContent = mainNginx;
  document.getElementById('result-deploy-notes').textContent = deployNotes;

  var extraResult = document.getElementById('result-extra-nginx');
  if (extraResult) {
    extraResult.textContent = extraNginx;
  }

  document.getElementById('name-main-nginx').textContent = state.mainDomain + '.conf';
  var nameExtra = document.getElementById('name-extra-nginx');
  if (nameExtra && hasExtra) {
    nameExtra.textContent = state.extraDomain + '.conf';
  }

  var resultsSection = document.getElementById('results-section');
  resultsSection.hidden = false;
  resultsSection.scrollIntoView({ behavior: 'smooth' });

  showNotification('生成成功：1Panel 中将 YAML 粘到“编排”，将 .env 粘到“环境变量”', 'success');
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
      title: type === 'success' ? '成功' : '提示',
      message: message,
      type: type || 'info'
    });
  } catch (e) {
    console.log('[ConfigGenerator]', message);
  }
}

// ========================================
// 生命周期入口
// ========================================

(function() {
  var mode = window._TAPP_MODE;
  var hasHtml = window._TAPP_HAS_HTML;

  if (mode === 'page' || hasHtml) {
    Tapp.lifecycle.onReady(function() {
      initPage();
    });
  }
})();
