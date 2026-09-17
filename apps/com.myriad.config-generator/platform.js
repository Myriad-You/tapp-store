// Deployment ownership stays with the physical Docker-host Compose directory.
// The platform's outer reverse proxy only joins Myriad's business network.
var PLATFORMS = {
  '1panel': '1Panel', baota: '宝塔', aapanel: 'aaPanel', generic: '通用 / CLI',
  portainer: 'Portainer', dockge: 'Dockge', coolify: 'Coolify', dokploy: 'Dokploy',
  npm: 'Nginx Proxy Manager', caddy: 'Caddy'
};
function shellQuote(value) { return "'" + String(value).replace(/'/g, "'\\''") + "'"; }
function checkedDomain(value) {
  if (!/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(value || '')) throw new Error('A validated domain is required for proxy configuration');
  return String(value).toLowerCase();
}
function buildTraefikConfig(panelId, ctx) {
  if (panelId !== 'coolify' && panelId !== 'dokploy') return null;
  var domain = checkedDomain(ctx.domain);
  var httpEntry = panelId === 'coolify' ? 'http' : 'web';
  var httpsEntry = panelId === 'coolify' ? 'https' : 'websecure';
  var domains = [domain];
  if (ctx.extraDomain) domains.push(checkedDomain(ctx.extraDomain));
  var rule = domains.map(function (name) { return 'Host(`' + name + '`)'; }).join(' || ');
  return {
    filename: 'myriad-traefik.yml',
    content: [
      '# File-provider dynamic configuration; keep separate from docker-compose.yml.',
      'http:', '  middlewares:', '    myriad-https-redirect:', '      redirectScheme:', '        scheme: https',
      '  routers:', '    myriad-main-http:', "      rule: '" + rule + "'", '      entryPoints: [' + httpEntry + ']',
      '      middlewares: [myriad-https-redirect]', '      service: myriad-main',
      '    myriad-main-https:', "      rule: '" + rule + "'", '      entryPoints: [' + httpsEntry + ']',
      '      service: myriad-main', '      tls:', '        certResolver: letsencrypt',
      '  services:', '    myriad-main:', '      loadBalancer:', '        passHostHeader: true', '        servers:',
      '          - url: http://myriad-proxy:80', ''
    ].join('\n')
  };
}
function buildPlatformGuide(panelId, ctx) {
  if (!PLATFORMS[panelId]) throw new Error('Unknown deployment platform: ' + panelId);
  var domain = checkedDomain(ctx.domain);
  var root = ctx.composeHostRoot;
  if (!root || root[0] !== '/' || /[\r\n\0]/.test(root)) throw new Error('An absolute Docker-host deployment directory is required');
  var network = ctx.netMyriad || 'myriad-net';
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(network)) throw new Error('Invalid Myriad business network');
  var port = Number(ctx.httpPort || 18080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid proxy host port');
  var lines = [
    '## ' + PLATFORMS[panelId] + ' 部署', '',
    '本方案使用 Docker 主机上的固定 Compose 项目。先把生成文件保存到 `' + root + '`：`docker-compose.yml`、`.env`、`guard-policy/docker-guard.env`。目录是 Docker daemon 所在服务器的真实路径，不是面板容器内路径。',
    '`.env` 必须是实际文件；面板 UI 环境变量仅供 Compose 插值，不能代替 updater 挂载的文件。三份文件与面板变量必须保持一致。项目名必须与 `.env` 的 `COMPOSE_PROJECT_NAME` 一致（新安装默认 `myriad`），保留生成的容器名、网络名和安全边界。', '',
    '在该服务器终端准备目录与权限，然后运行：', '```sh', 'cd ' + shellQuote(root),
    'mkdir -p state backups guard-policy', 'chmod 600 .env guard-policy/docker-guard.env'
  ];
  if (!ctx.external) lines.push('mkdir -p pgdata', 'chown -R 70:70 pgdata', 'chmod 700 pgdata');
  lines.push('docker compose --env-file .env config --quiet', 'docker compose --env-file .env up -d', 'docker compose --env-file .env ps', '```', '',
    '将 `' + domain + '` 的 A / AAAA 记录指向反代服务器；只发布实际可达的地址。证书签发还取决于公网 DNS、80/443 可达性与证书服务，这些没有在生成时实测。');
  if (panelId === 'portainer') lines.push('', 'Portainer 使用 Docker Standalone 环境查看该主机项目；不要用 Swarm Stack 替代。若通过 Stacks 管理，必须使用固定主机目录的同一份配置、相同的 `COMPOSE_PROJECT_NAME` 和完整变量，并确认预览未改变服务。Load variables from .env 只导入变量，仍须保存上面的真实 `.env` 文件。', '[Portainer 变量说明](https://docs.portainer.io/faqs/troubleshooting/stacks-deployments-and-updates/environment-variable-management-in-docker-.env-vs.-stack.env)');
  if (panelId === 'dockge') lines.push('', 'Dockge 若要接管，需将 stacks 目录在 Dockge 容器内按主机相同绝对路径挂载，项目目录指向上面的真实目录，项目名与原有 `COMPOSE_PROJECT_NAME` 一致。先确认 Dockge 编辑的是同一份 Compose 与 `.env`，避免创建第二套栈。', '[Dockge 官方部署说明](https://github.com/louislam/dockge#how-to-install)');
  if (['coolify', 'dokploy', 'npm'].indexOf(panelId) !== -1) {
    lines.push('', '### 容器反代接入', '',
      '外层反代是容器时，使用容器 DNS 与内部端口 `http://myriad-proxy:80`。在主机查出外层反代的实际容器名，再把它加入业务网络：',
      '```sh', 'docker ps --format "{{.Names}}"', '# 将 OUTER_PROXY_CONTAINER 替换成实际的外层反代容器名',
      'docker network connect ' + shellQuote(network) + ' OUTER_PROXY_CONTAINER', '```',
      '只连接外层反代到业务网络；不要给 Myriad 的 proxy、worker 或 backend 增加面板网络。不要将外层反代加入 admin / docker-guard 网络。',
      '一次 network connect 在外层容器重建后会丢失。将业务网络作为 external 网络加入外层反代自己的持久 Compose 配置；若面板重写该配置，需在反代重建后重新连接并验证。普通容器重启与容器重建不是同一操作。');
    if (panelId === 'npm') lines.push('', 'NPM → Proxy Hosts：Domain Names 填域名，Scheme 选 http，Forward Hostname 填 `myriad-proxy`，Forward Port 填 `80`，启用 Websockets Support，申请 SSL 并启用 Force SSL。必须整站 `/` 转发，不能只配置 `/api`。', '[NPM 官方网络说明](https://nginxproxymanager.com/advanced-config/#best-practice-use-a-docker-network)');
    else {
      lines.push('', '下载生成的 `myriad-traefik.yml`，作为外层 Traefik 的动态配置使用。它将整站（包括 WebSocket 和联邦路径）转发到 `myriad-proxy:80`。检查外层 Traefik 的 entryPoints 与 `letsencrypt` resolver 名称；若实际名称不同，只修改动态配置。避免同时为该域名建立另一条自动路由。');
      if (panelId === 'coolify') lines.push('Coolify：这里采用上面的主机 Compose 栈，使用 Servers → 目标服务器 → Proxy → Dynamic Configurations 添加该文件。不使用 Docker Compose Empty 自动部署该栈，也不让其改写 Myriad 容器和网络。Git-based Application 的 Raw Compose 是另一种高级路径，必须额外核实固定项目名与真实文件目录，不能当作 Compose Empty 的开关。', '[Coolify 动态路由](https://coolify.io/docs/core/networking/proxy/traefik/load-balancing)', '[Coolify Raw Compose 边界](https://coolify.io/docs/applications/builds/docker-compose)');
      else lines.push('Dokploy：在服务器的 Traefik File System 中添加该动态配置。上面的主机 Compose 是默认路径；若用 Dokploy Compose 管理，关闭 Isolated Deployments，保持 Domains 为空，使用 Preview Compose 核实没有网络、名称或标签改写，并核实项目名与主机文件路径。自动 Domains 会注入平台网络，不能直接用于此安全拓扑。', '[Dokploy 不改写 Compose 的条件](https://docs.dokploy.com/docs/core/docker-compose/domains)', '[Dokploy 文件路由](https://docs.dokploy.com/docs/core/domains)');
    }
    lines.push('', '接入后，从外层反代所在网络验证 `http://myriad-proxy:80/healthz`，再检查公网 HTTPS 与 WebSocket。生成器未连接你的服务器，不能确认运行状态。');
  } else {
    lines.push('', '### 宿主反代接入', '',
      '此配置面向与 Docker 主机共享宿主网络的 Nginx / OpenResty / Caddy；整站转发到 `http://127.0.0.1:' + port + '`，使用生成的站点配置并先执行配置检查。不要只转发 `/api`。');
    if (panelId === '1panel') lines.push('1Panel 的 OpenResty 若以 host 网络运行，可以使用上述宿主地址；先检查实际网络模式。若为 bridge 容器，必须使用下一段的容器接法。');
    if (panelId === 'caddy') lines.push('宿主 Caddy：保存生成的 Caddyfile，执行 `caddy validate --config Caddyfile` 后按服务管理方式加载。确保 80/443 没有被其他反代占用。');
    else lines.push('宿主 Nginx / OpenResty：在面板先创建站点并申请证书，核对证书路径，保存生成配置，执行 `nginx -t`（容器安装时在对应容器中执行），通过后 reload。');
    lines.push('如果外层反代实际运行在 bridge 容器内，宿主回环地址不可用：将该外层容器加入 `' + network + '`，把生成配置中的上游改为 `myriad-proxy:80`；内部健康检查上游同样改为该地址。将网络连接写入外层反代的持久配置，并在其重建后复核。不要因此放宽 Myriad 服务的网络权限。');
  }
  return lines.join('\n') + '\n';
}
module.exports = { buildPlatformGuide: buildPlatformGuide, buildTraefikConfig: buildTraefikConfig };
