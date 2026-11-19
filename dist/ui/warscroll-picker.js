'use strict';

function warscrollPicker(value) {
  return `<div class="field full">
    <label for="field-warscroll">Warscroll</label>
    <div class="warscroll-picker">
      <input id="field-warscroll" name="warscroll" type="text" value="${escape(value)}" maxlength="160"
        placeholder="Search or enter a custom warscroll" autocomplete="off" role="combobox"
        aria-autocomplete="list" aria-expanded="false" aria-controls="warscroll-options">
      <button type="button" class="warscroll-toggle" tabindex="-1" aria-label="Show warscrolls" aria-controls="warscroll-options"></button>
      <ul id="warscroll-options" class="warscroll-options" role="listbox" aria-label="Warscroll choices" hidden></ul>
    </div>
  </div>`;
}

function warscrollChoices(entries, query) {
  const text = query.trim();
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = entries.filter(entry => [entry.name, ...(entry.aliases || [])].some(name => words.every(word => name.toLowerCase().includes(word))));
  if (!text || matches.some(entry => [entry.name, ...(entry.aliases || [])].some(name => name.toLowerCase() === text.toLowerCase()))) return matches;
  return [...matches, { name: text, custom: true }];
}

function mountWarscrollPicker(form, entries) {
  const input = form.elements.warscroll;
  const list = form.querySelector('#warscroll-options');
  const toggle = form.querySelector('.warscroll-toggle');
  let options = [];
  let active = -1;

  function setOpen(open) {
    list.hidden = !open;
    input.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Hide warscrolls' : 'Show warscrolls');
    if (!open) input.removeAttribute('aria-activedescendant');
  }

  function show(query = '') {
    options = warscrollChoices(entries, query);
    active = -1;
    input.removeAttribute('aria-activedescendant');
    list.innerHTML = options.map((entry, index) => {
      const detail = entry.custom ? 'Use as a custom warscroll' : [fmt(entry.points) + ' pts', modelCount(entry.size), entry.kind].filter(Boolean).join(' · ');
      return `<li id="warscroll-option-${index}" role="option" aria-selected="false" data-option-index="${index}">
        <strong>${escape(entry.name)}</strong><span class="meta">${escape(detail)}</span></li>`;
    }).join('') || '<li class="warscroll-empty" role="presentation">Type a custom warscroll name.</li>';
    list.scrollTop = 0;
    setOpen(true);
  }

  function activate(index) {
    if (!options.length) return;
    if (active >= 0) list.children[active].setAttribute('aria-selected', 'false');
    active = (index + options.length) % options.length;
    const option = list.children[active];
    option.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function choose(name) {
    input.value = name;
    setOpen(false);
    input.focus({ preventScroll: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  input.addEventListener('click', () => { if (list.hidden) show(); });
  input.addEventListener('input', () => show(input.value));
  input.addEventListener('blur', () => setOpen(false));
  toggle.addEventListener('mousedown', event => event.preventDefault());
  toggle.addEventListener('click', () => {
    if (list.hidden) show();
    else setOpen(false);
    input.focus({ preventScroll: true });
  });
  list.addEventListener('mousedown', event => event.preventDefault());
  list.addEventListener('click', event => {
    const option = event.target.closest('[data-option-index]');
    if (option) choose(options[Number(option.dataset.optionIndex)].name);
  });
  input.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.hidden) show();
      activate(event.key === 'ArrowDown' ? active + 1 : active < 0 ? options.length - 1 : active - 1);
    } else if (!list.hidden && event.key === 'Enter') {
      event.preventDefault();
      choose(options[active]?.name ?? input.value.trim());
    } else if (!list.hidden && event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  });
}
