'use strict';

const dialog = document.querySelector('#dialog');

const { formDialog, confirmDialog, viewDialog, dialogEditor } = (() => {
  let editor;
  let lastFocus;

  function showDialog(title, body, wide = false) {
    if (!dialog.open) lastFocus = document.activeElement;
    dialog.classList.toggle('wide', wide);
    dialog.innerHTML = `<header class="dialog-head split"><h2 id="dialog-title" tabindex="-1">${escape(title)}</h2>${button('', 'close', { type: 'icon-only secondary', glyph: 'close', title: 'Close' })}</header>${body}`;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    dialog.querySelector('input:not([disabled]), textarea, select, h2[autofocus]')?.focus();
    if (!dialog.querySelector('input:not([disabled]), textarea, select')) dialog.querySelector('h2').focus();
  }

  function formDialog(title, fields, submit, { label = 'Save changes', description = '', remove } = {}) {
    editor = submit;
    showDialog(title, `<form id="editor-form"><div class="form-body">${description ? `<p class="copy muted" style="margin-bottom:15px">${escape(description)}</p>` : ''}<div class="form-grid">${fields}</div></div>
      <p class="form-error" role="alert" hidden></p><footer class="dialog-foot actions">${remove || ''}${button('Cancel', 'close')}<button type="submit" class="button primary">${escape(label)}</button></footer></form>`);
  }

  function confirmDialog(title, description, label, callback) {
    formDialog(title, '', callback, { label, description });
  }

  function viewDialog(title, details, actions = '', wide = false) {
    editor = null;
    showDialog(title, `<div class="form-body stack">${details}</div>${actions ? `<footer class="dialog-foot actions">${actions}</footer>` : ''}`, wide);
  }

  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    editor = null;
    if (lastFocus?.isConnected) lastFocus.focus();
    else document.querySelector('#main').focus();
  });

  return { formDialog, confirmDialog, viewDialog, dialogEditor: () => editor };
})();
