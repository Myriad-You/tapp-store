// ========================================
// Debug Page（API 测试）
// ========================================

(function () {
  var core = require('../core.js');

  function initDebug(container) {
    var tokenInput = container.querySelector('[data-debug-token]');
    var endpointSelect = container.querySelector('[data-debug-endpoint]');
    var paramsBox = container.querySelector('[data-debug-params]');
    var uidInput = container.querySelector('[data-debug-uid]');
    var sendBtn = container.querySelector('[data-debug-send]');
    var responsePanel = container.querySelector('[data-debug-response]');

    loadSavedToken(tokenInput);

    function updateParams() {
      var v = endpointSelect ? endpointSelect.value : '';
      if (paramsBox) {
        paramsBox.style.display = (v === 'binding') ? 'none' : 'flex';
      }
    }
    updateParams();

    if (endpointSelect) {
      endpointSelect.onchange = updateParams;
    }

    if (sendBtn) {
      sendBtn.onclick = function () {
        runRequest(tokenInput, endpointSelect, uidInput, responsePanel);
      };
    }
  }

  async function loadSavedToken(input) {
    if (!input) return;
    try {
      var saved = await Tapp.storage.get('hgToken');
      if (saved && typeof saved === 'string') {
        input.value = saved;
      }
    } catch (e) {}
  }

  async function runRequest(tokenInput, endpointSelect, uidInput, panel) {
    if (!panel) return;
    panel.innerHTML = '';

    var endpoint = endpointSelect ? endpointSelect.value : 'binding';
    var uid = uidInput ? uidInput.value.trim() : '';
    var hgToken = tokenInput ? tokenInput.value.trim() : '';

    var summary = document.createElement('div');
    summary.setAttribute(
      'style',
      'background:var(--ak-surface-inverse);border:1px solid rgba(255,255,255,0.14);' +
        'border-radius:var(--ak-radius-subtle);padding:10px;margin-top:8px;'
    );
    renderSummaryRow(summary, 'Request URL', 'https://zonai.skland.com' + endpointPath(endpoint));
    renderSummaryRow(summary, 'Method', 'GET');
    renderSummaryRow(summary, 'Auth', 'hgToken → cred+sign');
    panel.appendChild(summary);

    try {
      var skland = core.skland;
      if (!skland) throw new Error('skland module not loaded');

      var res;
      if (endpoint === 'info') {
        if (!uid) throw new Error('uid required');
        res = await skland.getPlayerInfo(uid, hgToken);
      } else if (endpoint === 'cultivate') {
        if (!uid) throw new Error('uid required');
        res = await skland.getCultivate(uid, hgToken);
      } else {
        res = await skland.getPlayerBinding(hgToken);
      }
      renderResponse(panel, res);
    } catch (e) {
      renderResponse(panel, { code: -1, msg: String((e && e.message) || e), data: null });
    }
  }

  function endpointPath(ep) {
    if (ep === 'info') return '/api/v1/game/player/info';
    if (ep === 'cultivate') return '/api/v1/game/cultivate/player';
    return '/api/v1/game/player/binding';
  }

  function renderSummaryRow(panel, label, value) {
    var row = document.createElement('div');
    row.setAttribute('style', 'display:flex;gap:8px;margin-top:4px;');

    var lab = document.createElement('span');
    lab.setAttribute('style', 'color:var(--ak-text-secondary);min-width:90px;font-size:11px;');
    lab.textContent = label;

    var val = document.createElement('span');
    val.setAttribute('style', 'color:var(--ak-text-inverse);font-size:12px;word-break:break-all;');
    val.textContent = value;

    row.appendChild(lab);
    row.appendChild(val);
    panel.appendChild(row);
  }

  function renderResponse(panel, res) {
    var block = document.createElement('div');
    block.setAttribute(
      'style',
      'background:var(--ak-surface-inverse);border:1px solid rgba(255,255,255,0.14);' +
        'border-radius:var(--ak-radius-subtle);padding:10px;margin-top:8px;'
    );

    var text = JSON.stringify(res, null, 2);

    var head = document.createElement('div');
    head.setAttribute('style', 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;');

    var hasCode = res && res.code !== undefined && res.code !== null;
    var code = hasCode ? res.code : '?';
    var color = code === 0 || code === 200 ? 'var(--ak-signal-success)' : code === -1 ? 'var(--ak-signal-danger)' : 'var(--ak-signal-action)';
    var codeLine = document.createElement('div');
    codeLine.setAttribute('style', 'font-size:12px;color:' + color + ';min-width:0;word-break:break-all;');
    codeLine.textContent = 'code: ' + code + (res && res.msg ? ' — ' + res.msg : '');
    head.appendChild(codeLine);

    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'ak-button';
    copyBtn.setAttribute('style', 'flex-shrink:0;font-size:11px;padding:4px 10px;cursor:pointer;');
    copyBtn.textContent = core.t('common.copy');
    copyBtn.addEventListener('click', function () {
      copyText(text, copyBtn);
    });
    head.appendChild(copyBtn);

    block.appendChild(head);

    var pre = document.createElement('pre');
    pre.setAttribute(
      'style',
      'margin:0;white-space:pre-wrap;word-break:break-all;color:var(--ak-text-inverse);font-size:12px;max-height:360px;overflow:auto;'
    );
    pre.textContent = text;
    block.appendChild(pre);
    panel.appendChild(block);
  }

  function copyText(text, btn) {
    function feedback(ok) {
      btn.textContent = ok ? core.t('common.copied') : core.t('common.copyFail');
      if (btn._copyTimer) clearTimeout(btn._copyTimer);
      btn._copyTimer = setTimeout(function () {
        btn.textContent = core.t('common.copy');
      }, 1500);
    }

    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('style', 'position:fixed;top:-9999px;left:-9999px;');
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (e) {
        return false;
      }
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { feedback(true); }, function () { feedback(fallback()); });
      } else {
        feedback(fallback());
      }
    } catch (e) {
      feedback(fallback());
    }
  }

  Tapp.pages['debug'] = {
    render: initDebug
  };
})();
