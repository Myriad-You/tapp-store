// Myriad Config Generator v1.0.0
// 一键生成 Myriad 部署配置文件

// ========================================
// 配置模板
// ========================================

var DOCKER_COMPOSE_TEMPLATE = `version: "3.8"

services:
  # ==================== PostgreSQL Database ====================
  postgres:
    image: postgres:16-alpine
    container_name: myriad-postgres
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    environment:
      POSTGRES_DB: myriad
      POSTGRES_USER: myriad
      POSTGRES_PASSWORD: {{DB_PASSWORD}}
      POSTGRES_INITDB_ARGS: "-E UTF8 --locale=C --lc-collate=C --lc-ctype=C"

      # PostgreSQL 性能优化参数
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
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: [ "CMD-SHELL", "pg_isready -U myriad -d myriad" ]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    networks:
      - myriad-net
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    read_only: false
    tmpfs:
      - /tmp
      - /run
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # ==================== Backend API ====================
  backend:
    image: somekawahitomi/myriad-backend:preview
    container_name: myriad-backend
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    environment:
      # 数据库连接 - ⚠️ 密码已 URL 编码
      DATABASE_URL: postgres://myriad:{{DB_PASSWORD_URL_ENCODED}}@postgres:5432/myriad

      # 服务器配置
      SERVER_HOST: 0.0.0.0
      SERVER_PORT: 3000

      # 安全配置
      JWT_SECRET: {{JWT_SECRET}}

      # CORS - 域名
      CORS_ORIGINS: https://{{MAIN_DOMAIN}},https://www.{{MAIN_DOMAIN}},https://{{API_DOMAIN}}

      # OAuth 回调
      FRONTEND_URL: https://{{MAIN_DOMAIN}}
      BASE_URL: https://{{API_DOMAIN}}

      # 日志
      RUST_LOG: info
      TZ: Asia/Shanghai
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: [ "CMD", "wget", "--spider", "-q", "http://localhost:3000/health" ]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    volumes:
      - backend_cache:/app/cache
      - backend_data:/app/data
    networks:
      - myriad-net
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    # ⚠️ 关键修复：使用 root 用户运行，确保有文件写入权限
    user: "0:0"
    read_only: false
    tmpfs:
      - /tmp
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # ==================== Frontend ====================
  frontend:
    image: somekawahitomi/myriad-frontend:preview
    container_name: myriad-frontend
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.25'
          memory: 256M
    environment:
      PUBLIC_API_URL: https://{{API_DOMAIN}}
      NODE_ENV: production
      TZ: Asia/Shanghai
    ports:
      - "4321:4321"
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: [ "CMD", "wget", "--spider", "-q", "http://localhost:4321" ]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    networks:
      - myriad-net
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

# ==================== Volumes ====================
volumes:
  postgres_data:
    driver: local
  backend_cache:
    driver: local
  backend_data:
    driver: local

# ==================== Networks ====================
networks:
  myriad-net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
`;

// 默认的主域名 Nginx 配置模板（无 SSL）
var DEFAULT_MAIN_NGINX_TEMPLATE = `server {
    listen 80;
    server_name {{MAIN_DOMAIN}};
    
    index index.php index.html index.htm default.php default.htm default.html;
    access_log /www/sites/{{MAIN_DOMAIN}}/log/access.log main;
    error_log /www/sites/{{MAIN_DOMAIN}}/log/error.log;

    # ----------------------------------------------------------------------
    # ⚠️ 关键点 1：使用 ^~ 提升优先级，确保 API 请求绝对不会进前端
    # ----------------------------------------------------------------------
    location ^~ /api/ {
        # ⚠️ 关键点 2：显式指定后端地址和路径
        proxy_pass http://127.0.0.1:3000/api/;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时设置 (5分钟)
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        
        proxy_cache off;
        client_max_body_size 20M;
    }

    # 健康检查
    location ^~ /health {
        proxy_pass http://127.0.0.1:3000/health;
        access_log off;
    }

    # ----------------------------------------------------------------------
    # 前端转发 (兜底规则)
    # ----------------------------------------------------------------------
    location / {
        proxy_pass http://127.0.0.1:4321;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 通用配置
    if ( $uri ~ "^/\\.well-known/.*\\.(php|jsp|py|js|css|lua|ts|go|zip|tar\\.gz|rar|7z|sql|bak)$" ) {
        return 403; 
    }
    root /www/sites/{{MAIN_DOMAIN}}/index; 
    error_page 404 /404.html;
}
`;

// 默认的 API 域名 Nginx 配置模板（无 SSL）
var DEFAULT_API_NGINX_TEMPLATE = `server {
    listen 80; 
    server_name {{API_DOMAIN}}; 
    index index.php index.html index.htm default.php default.htm default.html; 
    access_log /www/sites/{{API_DOMAIN}}/log/access.log main; 
    error_log /www/sites/{{API_DOMAIN}}/log/error.log; 
    
    location / {
        proxy_pass http://127.0.0.1:3000;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # ⚠️ 修改处：超时时间延长至 300s
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;

        # 请求体大小限制
        client_max_body_size 20M;
    }

    # 健康检查端点
    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        access_log off;
    }

    if ( $uri ~ "^/\\.well-known/.*\\.(php|jsp|py|js|css|lua|ts|go|zip|tar\\.gz|rar|7z|sql|bak)$" ) {
        return 403; 
    }
    root /www/sites/{{API_DOMAIN}}/index; 
    error_page 404 /404.html;
}
`;

// ========================================
// 工具函数
// ========================================

// 生成随机密码
function generatePassword(length) {
  var charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var password = '';
  var array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (var i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }
  return password;
}

// 生成 JWT 密钥（64字符）
function generateJwtSecret() {
  var charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var secret = '';
  var array = new Uint8Array(64);
  crypto.getRandomValues(array);
  for (var i = 0; i < 64; i++) {
    secret += charset[array[i] % charset.length];
  }
  return secret;
}

// URL 编码密码
function urlEncodePassword(password) {
  return encodeURIComponent(password);
}

// 替换 Nginx 配置中的域名
function replaceNginxDomain(config, oldDomain, newDomain) {
  // 替换 server_name
  config = config.replace(/server_name\s+[^;]+;/g, function(match) {
    return 'server_name ' + newDomain + ';';
  });
  
  // 替换路径中的域名（如 /www/sites/xxx/）
  var domainRegex = new RegExp('/www/sites/[^/]+/', 'g');
  config = config.replace(domainRegex, '/www/sites/' + newDomain + '/');
  
  // 替换 include 路径
  var includeRegex = new RegExp('include\\s+/www/sites/[^/]+/', 'g');
  config = config.replace(includeRegex, 'include /www/sites/' + newDomain + '/');
  
  return config;
}

// 提取原始域名
function extractDomain(config) {
  var match = config.match(/server_name\s+([^;]+);/);
  if (match) {
    return match[1].trim();
  }
  return null;
}

// ========================================
// 状态
// ========================================

var state = {
  mainDomain: '',
  apiDomain: '',
  dbPassword: '',
  jwtSecret: '',
  mainNginxConfig: null,
  apiNginxConfig: null,
  mainNginxFileName: '',
  apiNginxFileName: ''
};

// ========================================
// UI 交互
// ========================================

function initPage() {
  // 域名输入
  var mainDomainInput = document.getElementById('main-domain');
  var apiDomainInput = document.getElementById('api-domain');
  
  // 密码/密钥输入
  var dbPasswordInput = document.getElementById('db-password');
  var jwtSecretInput = document.getElementById('jwt-secret');
  
  // 生成按钮
  var genDbPasswordBtn = document.getElementById('gen-db-password');
  var genJwtSecretBtn = document.getElementById('gen-jwt-secret');
  var generateAllBtn = document.getElementById('btn-generate-all');
  
  // 文件上传
  var uploadMainConf = document.getElementById('upload-main-conf');
  var uploadApiConf = document.getElementById('upload-api-conf');
  var fileMainConf = document.getElementById('file-main-conf');
  var fileApiConf = document.getElementById('file-api-conf');
  
  // 自动填充 API 域名
  mainDomainInput.addEventListener('input', function() {
    var val = mainDomainInput.value.trim();
    if (val && !apiDomainInput.value) {
      apiDomainInput.value = 'api.' + val;
    }
  });
  
  // 生成数据库密码
  genDbPasswordBtn.addEventListener('click', function() {
    dbPasswordInput.value = generatePassword(32);
    animateButton(genDbPasswordBtn);
  });
  
  // 生成 JWT 密钥
  genJwtSecretBtn.addEventListener('click', function() {
    jwtSecretInput.value = generateJwtSecret();
    animateButton(genJwtSecretBtn);
  });
  
  // 文件上传 - 主域名配置
  setupFileUpload(uploadMainConf, fileMainConf, function(content, fileName) {
    state.mainNginxConfig = content;
    state.mainNginxFileName = fileName;
    showUploadSuccess(uploadMainConf, fileName);
  });
  
  // 文件上传 - API 域名配置
  setupFileUpload(uploadApiConf, fileApiConf, function(content, fileName) {
    state.apiNginxConfig = content;
    state.apiNginxFileName = fileName;
    showUploadSuccess(uploadApiConf, fileName);
  });
  
  // 生成配置
  generateAllBtn.addEventListener('click', async function() {
    var mainDomain = mainDomainInput.value.trim();
    var apiDomain = apiDomainInput.value.trim();
    var dbPassword = dbPasswordInput.value.trim();
    var jwtSecret = jwtSecretInput.value.trim();
    
    // 验证
    if (!mainDomain) {
      showNotification('请输入主域名', 'error');
      mainDomainInput.focus();
      return;
    }
    
    if (!apiDomain) {
      showNotification('请输入 API 域名', 'error');
      apiDomainInput.focus();
      return;
    }
    
    if (!dbPassword) {
      showNotification('请生成数据库密码', 'error');
      genDbPasswordBtn.click();
      return;
    }
    
    if (!jwtSecret) {
      showNotification('请生成 JWT 密钥', 'error');
      genJwtSecretBtn.click();
      return;
    }
    
    // 保存状态
    state.mainDomain = mainDomain;
    state.apiDomain = apiDomain;
    state.dbPassword = dbPassword;
    state.jwtSecret = jwtSecret;
    
    // 生成配置
    generateConfigs();
  });
  
  // 复制和下载按钮
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
      
      // 动态文件名
      if (target === 'main-nginx') {
        filename = state.mainDomain + '.conf';
      } else if (target === 'api-nginx') {
        filename = state.apiDomain + '.conf';
      }
      
      downloadFile(content, filename);
    });
  });
  
  // 自动生成密码和密钥
  genDbPasswordBtn.click();
  genJwtSecretBtn.click();
}

function setupFileUpload(uploadBox, fileInput, onLoad) {
  // 点击上传
  uploadBox.addEventListener('click', function(e) {
    if (e.target.classList.contains('btn-remove')) {
      return;
    }
    fileInput.click();
  });
  
  // 文件选择
  fileInput.addEventListener('change', function() {
    if (fileInput.files.length > 0) {
      readFile(fileInput.files[0], onLoad);
    }
  });
  
  // 拖拽
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
  
  // 移除按钮
  var removeBtn = uploadBox.querySelector('.btn-remove');
  if (removeBtn) {
    removeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      hideUploadSuccess(uploadBox);
      fileInput.value = '';
      
      // 清除状态
      if (uploadBox.id === 'upload-main-conf') {
        state.mainNginxConfig = null;
        state.mainNginxFileName = '';
      } else if (uploadBox.id === 'upload-api-conf') {
        state.apiNginxConfig = null;
        state.apiNginxFileName = '';
      }
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

function generateConfigs() {
  var dbPasswordUrlEncoded = urlEncodePassword(state.dbPassword);
  
  // 生成 Docker Compose
  var dockerCompose = DOCKER_COMPOSE_TEMPLATE
    .replace(/\{\{DB_PASSWORD\}\}/g, state.dbPassword)
    .replace(/\{\{DB_PASSWORD_URL_ENCODED\}\}/g, dbPasswordUrlEncoded)
    .replace(/\{\{JWT_SECRET\}\}/g, state.jwtSecret)
    .replace(/\{\{MAIN_DOMAIN\}\}/g, state.mainDomain)
    .replace(/\{\{API_DOMAIN\}\}/g, state.apiDomain);
  
  // 生成主域名 Nginx 配置
  var mainNginx;
  if (state.mainNginxConfig) {
    // 使用上传的配置，替换域名
    mainNginx = replaceNginxDomain(state.mainNginxConfig, extractDomain(state.mainNginxConfig), state.mainDomain);
  } else {
    // 使用默认模板
    mainNginx = DEFAULT_MAIN_NGINX_TEMPLATE
      .replace(/\{\{MAIN_DOMAIN\}\}/g, state.mainDomain);
  }
  
  // 生成 API 域名 Nginx 配置
  var apiNginx;
  if (state.apiNginxConfig) {
    // 使用上传的配置，替换域名
    apiNginx = replaceNginxDomain(state.apiNginxConfig, extractDomain(state.apiNginxConfig), state.apiDomain);
  } else {
    // 使用默认模板
    apiNginx = DEFAULT_API_NGINX_TEMPLATE
      .replace(/\{\{API_DOMAIN\}\}/g, state.apiDomain);
  }
  
  // 显示结果
  document.getElementById('result-docker-compose').textContent = dockerCompose;
  document.getElementById('result-main-nginx').textContent = mainNginx;
  document.getElementById('result-api-nginx').textContent = apiNginx;
  
  // 更新文件名
  document.getElementById('name-main-nginx').textContent = state.mainDomain + '.conf';
  document.getElementById('name-api-nginx').textContent = state.apiDomain + '.conf';
  
  // 显示结果区域
  var resultsSection = document.getElementById('results-section');
  resultsSection.hidden = false;
  
  // 滚动到结果
  resultsSection.scrollIntoView({ behavior: 'smooth' });
  
  showNotification('配置文件生成成功！', 'success');
}

// ========================================
// 通用工具
// ========================================

function copyToClipboard(text, btn) {
  var originalHTML = btn.innerHTML;
  
  // 尝试使用现代 Clipboard API
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
  
  // 方法1: 尝试使用 Clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(function(err) {
      // 方法2: 降级使用 execCommand
      fallbackCopy(text, onSuccess, onError);
    });
  } else {
    // 方法2: 降级使用 execCommand
    fallbackCopy(text, onSuccess, onError);
  }
}

function fallbackCopy(text, onSuccess, onError) {
  var textArea = document.createElement('textarea');
  textArea.value = text;
  
  // 确保不影响页面布局
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
  // 使用 Tapp SDK 的文件下载 API（绕过 iframe 沙盒限制）
  if (typeof Tapp !== 'undefined' && Tapp.file && Tapp.file.download) {
    Tapp.file.download(content, filename, 'text/plain;charset=utf-8')
      .then(function() {
        showNotification('文件下载成功: ' + filename, 'success');
      })
      .catch(function(err) {
        console.error('Tapp.file.download 失败:', err);
        // 降级到备用方案
        fallbackDownload(content, filename);
      });
  } else {
    // 降级到传统方案
    fallbackDownload(content, filename);
  }
}

function fallbackDownload(content, filename) {
  // 使用 Data URL 方式
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
