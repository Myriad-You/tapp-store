// ========================================
// Player Summary Widget
// 4x2：玩家头像 + 名称 / 玩家数据信息
// 4x4：额外展示助战干员
// ========================================

(function () {
  var core = require('../core.js');
  var cache = {
    propsKey: '',
    dataKey: '',
    html: ''
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // 预连接图片域名，省去 DNS / TLS 握手时间（每个 origin 只做一次）
  var _preconnected = {};
  function preconnectHost(url) {
    try {
      var m = /^(https?:\/\/[^/]+)/i.exec(String(url || ''));
      if (!m) return;
      var origin = m[1];
      if (_preconnected[origin]) return;
      _preconnected[origin] = true;
      var pc = document.createElement('link');
      pc.rel = 'preconnect';
      pc.href = origin;
      document.head.appendChild(pc);
      var dns = document.createElement('link');
      dns.rel = 'dns-prefetch';
      dns.href = origin;
      document.head.appendChild(dns);
    } catch (e) {}
  }

  // 提前发起图片下载，使 <img> 命中浏览器缓存 / 复用进行中的请求
  function preloadImages(urls) {
    for (var i = 0; i < urls.length; i++) {
      var url = urls[i];
      if (!url) continue;
      preconnectHost(url);
      try {
        var img = new Image();
        img.referrerPolicy = 'no-referrer';
        img.decoding = 'async';
        img.src = url;
      } catch (e) {}
    }
  }

  function formatDate(ts) {
    var d = new Date(Number(ts) * 1000);
    if (isNaN(d.getTime())) return '';
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function buildGlow(color) {
    return (
      '<div style="position:absolute;right:-24px;top:-24px;width:96px;height:96px;' +
      'border-radius:50%;background:' + color + ';filter:blur(48px);opacity:0.14;pointer-events:none;"></div>'
    );
  }

  function buildEditOverlay() {
    return '<div style="position:absolute;inset:0;border:2px dashed #60a5fa;border-radius:12px;pointer-events:none;"></div>';
  }

  function buildAvatar(c, scale, sizePx, src, eliteSrc, priority) {
    var html =
      '<div style="position:relative;width:' + sizePx + 'px;height:' + sizePx + 'px;flex-shrink:0;">' +
      '<div style="position:absolute;inset:0;border-radius:8px;overflow:hidden;background:' + c.cellBg + ';' +
      'border:1px solid ' + c.cellBorder + ';display:flex;align-items:center;justify-content:center;">' +
      '<span style="font-size:' + Math.round(sizePx * 0.45) + 'px;"> </span>';
    if (src) {
      html +=
        '<img referrerpolicy="no-referrer" src="' + esc(src) + '" alt="" decoding="async" ' +
        (priority ? 'fetchpriority="high" ' : '') +
        'style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;background:#000;' +
        'opacity:0;transition:opacity 0.25s ease;" />';
    }
    html += '</div>';
    if (eliteSrc) {
      html +=
        '<img referrerpolicy="no-referrer" src="' + esc(eliteSrc) + '" alt="" decoding="async" ' +
        'style="position:absolute;top:-2px;right:-2px;width:' + Math.round(sizePx * 0.32) + 'px;height:' +
        Math.round(sizePx * 0.32) + 'px;pointer-events:none;" />';
    }
    html += '</div>';
    return html;
  }

  function buildHeader(c, scale, fontScale, summary, big) {
    var html =
      '<div style="display:flex;align-items:center;gap:' + Math.round(10 * scale) + 'px;flex-shrink:0;">' +
      buildAvatar(c, scale, Math.round((big ? 56 : 44) * scale), summary.avatar, '', true) +
      '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;">' +
      '<div style="font-size:' + Math.round((big ? 17 : 15) * fontScale) + 'px;font-weight:700;color:' + c.textMain + ';' +
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(summary.name || '—') + '</div>';
    if (summary.level || summary.registerTs) {
      html +=
        '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:' + Math.round(6 * scale) + 'px;">';
      if (summary.level) {
        html +=
          '<span style="display:inline-block;padding:1px 8px;border-radius:999px;' +
          'background:' + c.cellBg + ';border:1px solid ' + c.cellBorder + ';' +
          'font-size:' + Math.round(11 * fontScale) + 'px;font-weight:700;color:' + c.textDim + ';">' +
          esc('Lv.' + summary.level) + '</span>';
      }
      if (summary.registerTs) {
        html +=
          '<span style="display:inline-block;padding:1px 8px;border-radius:999px;' +
          'background:' + c.cellBg + ';border:1px solid ' + c.cellBorder + ';' +
          'font-size:' + Math.round(10 * fontScale) + 'px;font-weight:600;color:' + c.textDim + ';' +
          'letter-spacing:0.3px;white-space:nowrap;">' +
          esc(core.t('home.enroll') + ' ' + formatDate(summary.registerTs)) + '</span>';
      }
      html += '</div>';
    }
    html += '</div></div>';
    return html;
  }

  function buildStats(c, scale, fontScale, summary) {
    var html = '<div style="display:flex;gap:' + Math.round(6 * scale) + 'px;">';
    for (var i = 0; i < summary.items.length; i++) {
      if (summary.items[i][0] === 'assets.furniture') continue;
      html +=
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;' +
        'background:' + c.cellBg + ';border:1px solid ' + c.cellBorder + ';border-radius:8px;' +
        'padding:' + Math.round(6 * scale) + 'px ' + Math.round(8 * scale) + 'px;">' +
        '<span style="font-size:' + Math.round(9 * fontScale) + 'px;color:' + c.textMuted + ';' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(core.t(summary.items[i][0])) + '</span>' +
        '<span style="font-size:' + Math.round(13 * fontScale) + 'px;font-weight:700;color:' + c.textMain + ';' +
        'margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
        esc(summary.items[i][1]) + '</span>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function buildAssistUnits(c, scale, fontScale, units, uid) {
    if (!units.length) {
      return '<div style="font-size:' + Math.round(11 * fontScale) + 'px;color:' + c.textMuted + ';">' +
        esc(core.t('assets.noSupport')) + '</div>';
    }
    var html = '<div style="display:flex;gap:' + Math.round(10 * scale) + 'px;justify-content:center;width:100%;">';
    for (let i = 0; i < units.length; i++) {
      var u = units[i];
      html +=
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;">' +
        buildAvatar(c, scale, Math.round(64 * scale), u.avatarUrl, u.eliteUrl) +
        '<span style="font-size:' + Math.round(11 * fontScale) + 'px;font-weight:600;color:' + c.textMain + ';' +
        'max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(core.getOperatorName(u.id, uid)) + '</span>' +
        '<span style="font-size:' + Math.round(10 * fontScale) + 'px;color:' + c.textMuted + ';">' +
        esc('LV' + (u.level != null ? u.level : '?')) + '</span>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function buildWide(c, primary, scale, fontScale, summary, props) {
    return (
      '<div class="w-glass" style="position:relative;width:100%;height:100%;border-radius:12px;overflow:hidden;' +
      'background:' + c.bg + ';border:1px solid ' + c.border + ';">' +
      buildGlow(primary) +
      '<div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;' +
      'padding:' + Math.round(12 * scale) + 'px;">' +
      buildHeader(c, scale, fontScale, summary, false) +
      '<div style="margin-top:' + Math.round(12 * scale) + 'px;">' + buildStats(c, scale, fontScale, summary) + '</div>' +
      (props.isEditMode ? buildEditOverlay() : '') +
      '</div></div>'
    );
  }

  function buildLarge(c, primary, scale, fontScale, summary, assist, props, uid) {
    return (
      '<div class="w-glass" style="position:relative;width:100%;height:100%;border-radius:12px;overflow:hidden;' +
      'background:' + c.bg + ';border:1px solid ' + c.border + ';">' +
      buildGlow(primary) +
      '<div style="position:absolute;inset:0;display:flex;flex-direction:column;' +
      'padding:' + Math.round(14 * scale) + 'px;">' +
      buildHeader(c, scale, fontScale, summary, true) +
      '<div style="margin-top:' + Math.round(14 * scale) + 'px;">' + buildStats(c, scale, fontScale, summary) + '</div>' +
      '<div style="display:flex;align-items:baseline;justify-content:space-between;flex-shrink:0;' +
      'margin-top:' + Math.round(16 * scale) + 'px;margin-bottom:' + Math.round(8 * scale) + 'px;">' +
      '<span style="font-size:' + Math.round(12 * fontScale) + 'px;font-weight:600;color:' + c.textMain + ';">' +
      esc(core.t('assets.supportUnits')) + '</span>' +
      '<span style="font-size:' + Math.round(9 * fontScale) + 'px;letter-spacing:0.5px;color:' + c.textMuted + ';">' +
      '// SUPPORT UNITS</span>' +
      '</div>' +
      '<div style="flex:1;min-height:0;display:flex;align-items:center;">' +
      buildAssistUnits(c, scale, fontScale, assist, uid) +
      '</div>' +
      (props.isEditMode ? buildEditOverlay() : '') +
      '</div></div>'
    );
  }

  function buildMessage(c, primary, scale, fontScale, msgKey, icon) {
    return (
      '<div class="w-glass" style="position:relative;width:100%;height:100%;border-radius:12px;overflow:hidden;' +
      'background:' + c.bg + ';border:1px solid ' + c.border + ';">' +
      buildGlow(primary) +
      '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;padding:12px;">' +
      '<span style="font-size:' + Math.round(24 * scale) + 'px;margin-bottom:6px;">' + esc(icon || ' ') + '</span>' +
      '<span style="font-size:' + Math.round(12 * fontScale) + 'px;color:' + c.textMuted + ';text-align:center;">' +
      esc(core.t(msgKey)) + '</span>' +
      '</div></div>'
    );
  }

  function buildLoading(c, primary, scale) {
    return (
      '<div class="w-glass" style="position:relative;width:100%;height:100%;border-radius:12px;overflow:hidden;' +
      'background:' + c.bg + ';border:1px solid ' + c.border + ';">' +
      buildGlow(primary) +
      '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">' +
      '<div class="ak-loading" style="--ak-loading-size:' + Math.round(26 * scale) + 'px;' +
      '--ak-loading-border:3px;--ak-loading-color:' + primary + ';"></div>' +
      '</div></div>'
    );
  }

  function bindImgFallback(container) {
    var imgs = container.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      (function (img) {
        img.onerror = function () {
          img.style.display = 'none';
        };
        // 命中缓存时 onload 可能已触发，直接淡入；否则等加载完成
        if (img.complete && img.naturalWidth) {
          img.style.opacity = '1';
        } else {
          img.onload = function () {
            img.style.opacity = '1';
          };
        }
      })(imgs[i]);
    }
  }

  // 解析本卡片应展示的玩家 uid：
  // - 配置了 uid：存在于可读列表 → 使用；否则提示无权访问 / 账户不存在
  // - 未配置：与 Page 一致，lastViewed → isDefault → 第一个
  async function resolveUid(map, wantUid) {
    if (wantUid) {
      if (map && map[wantUid]) return { uid: wantUid };
      var admin = false;
      try { admin = !!(await Tapp.user.isAdmin()); } catch (e) {}
      return { error: admin ? 'widget.notFound' : 'widget.noAccess' };
    }
    var lastUid = await core.getLastViewedUid();
    var entry = core.pickPlayerEntry(map, lastUid);
    if (entry && entry.uid) return { uid: entry.uid };
    return { error: 'widget.empty' };
  }

  function render(container, props) {
    props = props || {};
    var size = props.size || '4x2';
    var theme = props.theme || 'dark';
    var scale = props.scale || 1;
    var fontScale = props.fontScale || 1;
    var primary = props.primaryColor || '#8b5cf6';
    var config = props.config || props.settings || {};
    var wantUid = String(config.uid || '').trim();

    var c = {
      bg: 'var(--w-bg)',
      border: 'var(--w-border)',
      cellBorder: 'var(--w-cell-border)',
      textMain: 'var(--w-text-main)',
      textDim: 'var(--w-text-dim)',
      textMuted: 'var(--w-text-muted)',
      cellBg: 'var(--w-cell-bg)'
    };

    var propsKey = [
      size,
      theme,
      String(scale),
      String(fontScale),
      primary,
      wantUid,
      props.isEditMode ? 'edit' : 'view'
    ].join('|');

    // 首帧同步渲染：容器为空时优先复用上次已渲染的真实数据 HTML，
    // 避免重建容器时先闪现加载动画；仅首次真正无缓存时才显示加载动画
    if (!container.firstChild) {
      if (cache.html && cache.propsKey === propsKey) {
        container.innerHTML = cache.html;
        bindImgFallback(container);
      } else {
        container.innerHTML = buildLoading(c, primary, scale);
      }
    }

    return (async function () {
      // 与 Page 一致：管理员读私有列表、非管理员读公开列表
      var map = await core.getPlayerMap();
      var resolved = await resolveUid(map, wantUid);

      if (resolved.uid) await core.loadPlayerData(resolved.uid);

      var dataKey = resolved.error
        ? 'err:' + resolved.error
        : resolved.uid + ':' + (core.getDataUpdateTs(resolved.uid) || 'no-ts');

      // 数据未变化且容器已显示对应内容时跳过重建
      if (cache.html && cache.propsKey === propsKey && cache.dataKey === dataKey) {
        if (!container.firstChild) {
          container.innerHTML = cache.html;
          bindImgFallback(container);
        }
        return;
      }

      cache.propsKey = propsKey;
      cache.dataKey = dataKey;

      if (resolved.error) {
        var icon = resolved.error === 'widget.noAccess' ? '🔒' : (resolved.error === 'widget.notFound' ? '❔' : ' ');
        cache.html = buildMessage(c, primary, scale, fontScale, resolved.error, icon);
      } else {
        var summary = core.generatePlayerSummary(resolved.uid);
        if (!summary || (!summary.name && !summary.level)) {
          cache.html = buildMessage(c, primary, scale, fontScale, 'widget.empty', ' ');
        } else {
          // 主头像尽早开始下载，与助战干员 URL 计算并行
          if (summary.avatar) preloadImages([summary.avatar]);

          var assist = size === '4x4' ? await core.getAssistUnits(resolved.uid) : [];

          if (assist.length) {
            var assistUrls = [];
            for (var ai = 0; ai < assist.length; ai++) assistUrls.push(assist[ai].avatarUrl);
            preloadImages(assistUrls);
          }

          cache.html = size === '4x4'
            ? buildLarge(c, primary, scale, fontScale, summary, assist, props, resolved.uid)
            : buildWide(c, primary, scale, fontScale, summary, props);
        }
      }

      container.innerHTML = cache.html;
      bindImgFallback(container);
    })();
  }

  Tapp.widgets['player-summary'] = {
    render: render
  };
})();
