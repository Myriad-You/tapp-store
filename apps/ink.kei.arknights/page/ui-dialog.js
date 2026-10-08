// ========================================
// UI Dialog / ak-dialog
// 基于原生 <dialog>.showModal()（顶层渲染、ESC 关闭、背景 inert），
// 用 ak-ui system 样式呈现；替代宿主 Tapp.ui.confirm。
// ========================================

(function () {
  var core = require('../core.js');
  var seq = 0;

  // 确认对话框；返回 Promise<boolean>
  function confirm(message, options) {
    options = options || {};
    return new Promise(function (resolve) {
      var dlg = document.createElement('dialog');
      dlg.setAttribute('class', 'ak-dialog');
      dlg.setAttribute('data-ak-ui', '');
      dlg.setAttribute('role', 'alertdialog');
      dlg.setAttribute('aria-modal', 'true');

      var panel = document.createElement('div');
      panel.setAttribute('class', 'ak-dialog__panel');

      if (options.eyebrow) {
        var eyebrow = document.createElement('span');
        eyebrow.setAttribute('class', 'ak-dialog__eyebrow');
        eyebrow.textContent = options.eyebrow;
        panel.appendChild(eyebrow);
      }

      var titleId = 'ak-dialog-title-' + (++seq);
      var title = document.createElement('h2');
      title.setAttribute('class', 'ak-dialog__title');
      title.setAttribute('id', titleId);
      title.textContent = options.title || core.t('common.confirm');
      panel.appendChild(title);
      dlg.setAttribute('aria-labelledby', titleId);

      var desc = document.createElement('p');
      desc.setAttribute('class', 'ak-dialog__description');
      desc.textContent = message || '';
      panel.appendChild(desc);

      var actions = document.createElement('div');
      actions.setAttribute('class', 'ak-dialog__actions');

      var cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.setAttribute('class', 'ak-button ak-button--ghost ak-dialog__cancel');
      cancelBtn.textContent = options.cancelText || core.t('common.cancel');

      var confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.setAttribute(
        'class',
        'ak-button ak-dialog__confirm ' + (options.danger ? 'ak-button--danger' : 'ak-button--info')
      );
      confirmBtn.textContent = options.confirmText || core.t('common.confirm');

      actions.appendChild(cancelBtn);
      actions.appendChild(confirmBtn);
      panel.appendChild(actions);
      dlg.appendChild(panel);
      document.body.appendChild(dlg);

      var settled = false;
      function close(result) {
        if (settled) return;
        settled = true;
        try { dlg.close(); } catch (e) {}
        if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
        resolve(result);
      }

      cancelBtn.addEventListener('click', function () { close(false); });
      confirmBtn.addEventListener('click', function () { close(true); });
      dlg.addEventListener('click', function (e) {
        if (e.target === dlg) close(false);
      });
      dlg.addEventListener('cancel', function (e) {
        e.preventDefault();
        close(false);
      });

      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
      confirmBtn.focus();
    });
  }

  window.__arkDialog = {
    confirm: confirm
  };
})();
