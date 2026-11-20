'use strict';

function importedChoiceFields(choices, label = 'Faction reference') {
  if (!choices.length) return '';
  return `<div class="full">${select(label, 'importedChoice', [['', 'Choose an imported item'], ...choices.map((item, index) => [String(index), item.name])], '')}
    <div class="actions"><button class="button secondary" type="button" id="apply-imported-choice">Use selected item</button></div>
    <p class="meta" id="imported-choice-status" aria-live="polite">Apply a reference to fill the editor, then customize any field before saving.</p></div>`;
}

function mountImportedChoice(form, choices, apply) {
  const control = form.elements?.importedChoice;
  const button = form.querySelector?.('#apply-imported-choice');
  if (!control || !button) return;
  button.disabled = true;
  control.addEventListener('change', () => { button.disabled = control.value === ''; });
  button.addEventListener('click', () => {
    if (control.value === '') return;
    const item = choices[Number(control.value)];
    if (!item) return;
    apply(item);
    form.querySelector('#imported-choice-status').textContent = `Loaded ${item.name}. Review your copy below before saving.`;
    form.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function textPicker(label, key, value, { full = false, required = false } = {}) {
  return `<div class="field${full ? ' full' : ''}">
    <label for="field-${key}">${escape(label)}</label>
    <div class="text-picker">
      <input id="field-${key}" name="${key}" type="text" value="${escape(value)}" maxlength="160"${required ? ' required' : ''}
        placeholder="Search or enter a custom ${key}" autocomplete="off" role="combobox"
        aria-autocomplete="list" aria-expanded="false" aria-controls="${key}-options">
      <button type="button" class="picker-toggle" tabindex="-1" aria-label="Show ${key} choices" aria-controls="${key}-options"></button>
      <ul id="${key}-options" class="text-picker-menu" role="listbox" aria-label="${escape(label)} choices" hidden></ul>
    </div>
  </div>`;
}

function textPickerChoices(entries, query) {
  const text = query.trim();
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = entries.filter(entry => [entry.name, ...(entry.aliases || [])].some(name => words.every(word => name.toLowerCase().includes(word))));
  if (!text || matches.some(entry => [entry.name, ...(entry.aliases || [])].some(name => name.toLowerCase() === text.toLowerCase()))) return matches;
  return [...matches, { name: text, custom: true }];
}

function mountTextPicker(form, key, entries) {
  const input = form.elements[key];
  const list = form.querySelector(`#${key}-options`);
  const toggle = input.nextElementSibling;
  let options = [];
  let active = -1;

  function setOpen(open) {
    list.hidden = !open;
    input.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', `${open ? 'Hide' : 'Show'} ${key} choices`);
    if (!open) input.removeAttribute('aria-activedescendant');
  }

  function show(query = '') {
    options = textPickerChoices(entries, query);
    active = -1;
    input.removeAttribute('aria-activedescendant');
    list.innerHTML = options.map((entry, index) => {
      const detail = entry.custom ? `Use as a custom ${key}` : entry.detail;
      return `<li id="${key}-option-${index}" role="option" aria-selected="false" data-option-index="${index}">
        <strong>${escape(optionTitle(entry.name))}</strong>${detail ? `<span class="meta">${escape(detail)}</span>` : ''}</li>`;
    }).join('') || `<li class="text-picker-empty" role="presentation">Type a custom ${key} name.</li>`;
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
  return {
    setEntries(next) {
      entries = next;
      if (!list.hidden) show(input.value);
    },
  };
}
