'use strict';

function profileEditorFields(open) {
  return `<section class="full unit-profile-editor" aria-label="Unit profile">
    <div class="split"><h3>Unit profile</h3><button type="button" class="button link" data-profile-action="reset">Reset profile fields</button></div>
    <details${open ? ' open' : ''}><summary>Characteristics</summary><div class="profile-fields" data-profile-list="stats"></div></details>
    <details><summary>Weapons</summary><div data-profile-list="melee"></div><div data-profile-list="ranged"></div>
      <div class="actions"><button type="button" class="button secondary" data-profile-action="melee">Add melee weapon</button><button type="button" class="button secondary" data-profile-action="ranged">Add ranged weapon</button></div></details>
    <details><summary>Abilities and Path upgrades</summary><div data-profile-list="abilities"></div>
      <div class="actions"><button type="button" class="button secondary" data-profile-action="abilities">Add ability</button><button type="button" class="button secondary" data-profile-action="path">Add Path upgrade</button></div></details>
  </section>`;
}

function attachProfileEditor(form, initialProfile, savedEdits) {
  const root = form.querySelector('.unit-profile-editor');
  const list = kind => root.querySelector(`[data-profile-list="${kind}"]`);
  const names = ['melee', 'ranged', 'abilities'];
  let sequence = 0;
  let currentProfile = initialProfile;
  let defaults = Ledger.profileDefaults(initialProfile);

  function addRow(kind, data) {
    const id = `profile-${++sequence}`;
    const ability = kind === 'abilities';
    const title = ability ? 'Ability' : kind === 'melee' ? 'Melee weapon' : 'Ranged weapon';
    let markup;
    if (ability) {
      markup = field('Ability name', `${id}-name`, data?.name, { required: true }) +
        select('Type', `${id}-kind`, ['Ability', 'Path upgrade'], data?.kind || 'Ability') +
        field('Timing', `${id}-timing`, data?.timing, { placeholder: 'e.g. Passive or Any Combat Phase', full: true }) +
        area('Rules and effect', `${id}-effect`, data?.effect, 4);
    } else {
      const labels = ['Weapon name', ...Ledger.weaponFields(kind === 'ranged')];
      markup = labels.map((label, index) => field(label, `${id}-${index}`, data?.[index], { full: index === 0 || index === labels.length - 1, required: index === 0 })).join('');
    }
    const target = list(kind);
    target.insertAdjacentHTML('beforeend', `<fieldset class="profile-row"><legend>${title}</legend><div class="profile-fields">${markup}</div><button type="button" class="button link" data-profile-action="remove">Remove ${title.toLowerCase()}</button></fieldset>`);
    return target.lastElementChild;
  }

  function render(edits) {
    const stats = { ...defaults.stats, ...edits?.stats };
    list('stats').innerHTML = Object.entries(Ledger.profileStats).map(([key, label]) => field(label, `profile-${key}`, stats[key])).join('');
    for (const kind of names) {
      list(kind).replaceChildren();
      for (const item of edits?.[kind] ?? defaults[kind]) addRow(kind, item);
    }
  }

  function changes() {
    const value = el => el.value.trim();
    const inputs = (node, selector = 'input') => Array.from(node.querySelectorAll(selector), value);
    const stats = Object.fromEntries(Object.keys(Ledger.profileStats).map(key => [key, value(form.elements[`profile-${key}`])]));
    const rows = kind => Array.from(list(kind).children);
    const abilities = rows('abilities').map(row => {
      const [name, kind, timing, effect] = inputs(row, 'input, select, textarea');
      return { name, timing, effect, kind };
    });
    return Ledger.profileChanges(defaults, { stats, melee: rows('melee').map(row => inputs(row)), ranged: rows('ranged').map(row => inputs(row)), abilities });
  }

  root.addEventListener('click', event => {
    const action = event.target.closest('[data-profile-action]')?.dataset.profileAction;
    if (!action) return;
    if (action === 'reset') render(null);
    else if (action === 'remove') {
      const row = event.target.closest('.profile-row');
      const next = row.nextElementSibling || row.previousElementSibling;
      const fallback = row.closest('details').querySelector('summary');
      row.remove();
      (next?.querySelector('input') || fallback).focus();
    } else {
      const row = action === 'path' ? addRow('abilities', { kind: 'Path upgrade' }) : addRow(action);
      row.querySelector('input').focus();
    }
  });
  root.addEventListener('invalid', event => { event.target.closest('details').open = true; }, true);
  render(savedEdits);
  return {
    changes: () => Ledger.normalizeProfileEdits(changes()),
    rebase(profile) {
      if (profile === currentProfile) return;
      const edits = changes();
      currentProfile = profile;
      defaults = Ledger.profileDefaults(profile);
      render(edits);
    },
  };
}
