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

  function buildAvatar(c, scale, sizePx, src, eliteSrc) {
    var html =
      '<div style="position:relative;width:' + sizePx + 'px;height:' + sizePx + 'px;flex-shrink:0;">' +
      '<div style="position:absolute;inset:0;border-radius:8px;overflow:hidden;background:' + c.cellBg + ';' +
      'border:1px solid ' + c.cellBorder + ';display:flex;align-items:center;justify-content:center;">' +
      '<span style="font-size:' + Math.round(sizePx * 0.45) + 'px;"> </span>';
    if (src) {
      html +=
        '<img referrerpolicy="no-referrer" src="' + esc(src) + '" alt="" ' +
        'style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;background:#000;" />';
    }
    html += '</div>';
    if (eliteSrc) {
      html +=
        '<img referrerpolicy="no-referrer" src="' + esc(eliteSrc) + '" alt="" ' +
        'style="position:absolute;top:-2px;right:-2px;width:' + Math.round(sizePx * 0.32) + 'px;height:' +
        Math.round(sizePx * 0.32) + 'px;pointer-events:none;" />';
    }
    html += '</div>';
    return html;
  }

  function buildHeader(c, scale, fontScale, summary, big) {
    var html =
      '<div style="display:flex;align-items:center;gap:' + Math.round(10 * scale) + 'px;flex-shrink:0;">' +
      buildAvatar(c, scale, Math.round((big ? 56 : 44) * scale), summary.avatar) +
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
          '<span style="font-size:' + Math.round(10 * fontScale) + 'px;color:' + c.textDim + ';letter-spacing:0.4px;">' +
          esc(formatDate(summary.registerTs)) + '</span>';
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

  function buildAssistUnits(c, scale, fontScale, units) {
    if (!units.length) {
      return '<div style="font-size:' + Math.round(11 * fontScale) + 'px;color:' + c.textMuted + ';">' +
        esc(core.t('assets.noSupport')) + '</div>';
    }
    var html = '<div style="display:flex;gap:' + Math.round(10 * scale) + 'px;justify-content:center;width:100%;">';
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      html +=
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;">' +
        buildAvatar(c, scale, Math.round(64 * scale), u.avatarUrl, u.eliteUrl) +
        '<span style="font-size:' + Math.round(11 * fontScale) + 'px;font-weight:600;color:' + c.textMain + ';' +
        'max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(u.name) + '</span>' +
        '<span style="font-size:' + Math.round(10 * fontScale) + 'px;color:' + c.textMuted + ';">' +
        esc('LV' + (u.level != null ? u.level : '?')) + '</span>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function buildWide(c, primary, scale, fontScale, summary, props) {
    return (
      '<div style="position:relative;width:100%;height:100%;border-radius:12px;overflow:hidden;' +
      'background:' + c.bg + ';border:1px solid ' + c.border + ';' + c.glass + '">' +
      buildGlow(primary) +
      '<div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;' +
      'padding:' + Math.round(12 * scale) + 'px;">' +
      buildHeader(c, scale, fontScale, summary, false) +
      '<div style="margin-top:' + Math.round(12 * scale) + 'px;">' + buildStats(c, scale, fontScale, summary) + '</div>' +
      (props.isEditMode ? buildEditOverlay() : '') +
      '</div></div>'
    );
  }

  function buildLarge(c, primary, scale, fontScale, summary, assist, props) {
    return (
      '<div style="position:relative;width:100%;height:100%;border-radius:12px;overflow:hidden;' +
      'background:' + c.bg + ';border:1px solid ' + c.border + ';' + c.glass + '">' +
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
      buildAssistUnits(c, scale, fontScale, assist) +
      '</div>' +
      (props.isEditMode ? buildEditOverlay() : '') +
      '</div></div>'
    );
  }

  function buildEmpty(c, primary, scale, fontScale) {
    return (
      '<div style="position:relative;width:100%;height:100%;border-radius:12px;overflow:hidden;' +
      'background:' + c.bg + ';border:1px solid ' + c.border + ';' + c.glass + '">' +
      buildGlow(primary) +
      '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;padding:12px;">' +
      '<span style="font-size:' + Math.round(24 * scale) + 'px;margin-bottom:6px;">🛡️</span>' +
      '<span style="font-size:' + Math.round(12 * fontScale) + 'px;color:' + c.textMuted + ';text-align:center;">' +
      esc(core.t('widget.empty')) + '</span>' +
      '</div></div>'
    );
  }

  function buildShell(c, primary, scale, fontScale, size, props) {
    var placeholder = {
      name: '—',
      avatar: '',
      level: '',
      items: [
        ['assets.progress', '—'],
        ['assets.operators', '—'],
        ['assets.skins', '—'],
        ['assets.furniture', '—'],
        ['assets.medals', '—']
      ]
    };
    return size === '4x4'
      ? buildLarge(c, primary, scale, fontScale, placeholder, [], props)
      : buildWide(c, primary, scale, fontScale, placeholder, props);
  }

  function bindImgFallback(container) {
    var imgs = container.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      (function (img) {
        img.onerror = function () {
          img.style.display = 'none';
        };
      })(imgs[i]);
    }
  }

  function render(container, props) {
    props = props || {};
    var size = props.size || '4x2';
    var theme = props.theme || 'dark';
    var scale = props.scale || 1;
    var fontScale = props.fontScale || 1;
    var primary = props.primaryColor || '#8b5cf6';

    var isDark = theme === 'dark';
    var c = {
      bg: isDark ? 'rgba(26,26,26,0.8)' : 'rgba(255,255,255,0.7)',
      glass: 'backdrop-filter:blur(16px) saturate(180%);-webkit-backdrop-filter:blur(16px) saturate(180%);',
      border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.3)',
      cellBorder: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
      textMain: isDark ? '#f5f5f5' : '#1f1f1f',
      textDim: isDark ? '#a3a3a3' : '#4b5563',
      textMuted: isDark ? '#737373' : '#9ca3af',
      cellBg: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
    };

    var propsKey = [
      size,
      theme,
      String(scale),
      String(fontScale),
      primary,
      props.isEditMode ? 'edit' : 'view'
    ].join('|');

    // 首帧同步渲染：容器为空时优先复用上次已渲染的真实数据 HTML，
    // 避免 refreshOnVisible 重建容器时先闪现“占位壳”；仅首次真正无缓存时才用占位壳
    if (!container.firstChild) {
      if (cache.html && cache.propsKey === propsKey) {
        container.innerHTML = cache.html;
        bindImgFallback(container);
      } else {
        container.innerHTML = buildShell(c, primary, scale, fontScale, size, props);
      }
    }

    return (async function () {
      var data = null;
      try {
        data = await Tapp.shared.get(core.PLAYER_DATA_KEY);
      } catch (e) {}

      var dataKey = data && data.data ? String(data.ts || 'no-ts') : 'empty';

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

      if (!data || !data.data) {
        cache.html = buildEmpty(c, primary, scale, fontScale);
      } else {
        var summary = core.getPlayerSummary(data.data);
        var assist = size === '4x4' ? await core.getAssistUnits(data.data) : [];
        cache.html = size === '4x4'
          ? buildLarge(c, primary, scale, fontScale, summary, assist, props)
          : buildWide(c, primary, scale, fontScale, summary, props);
      }

      container.innerHTML = cache.html;
      bindImgFallback(container);
    })();
  }

  Tapp.widgets['player-summary'] = {
    render: render
  };
})();
