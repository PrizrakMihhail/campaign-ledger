'use strict';

const storageKey = 'ptg_campaign_ledger_v2';
const legacyKey = 'ptg_campaign_ledger_v1';
const main = document.querySelector('#main');
const dialog = document.querySelector('#dialog');
const importFile = document.querySelector('#import-file');
const toast = document.querySelector('#toast');
const pages = {
  overview: ['Overview', 'overview'], warbands: ['Warbands', 'shield'], battles: ['Battles', 'swords'],
  quests: ['Quests', 'flag'], chronicle: ['Chronicle', 'book'], settings: ['Settings', 'settings'],
};
const icons = {
  overview: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  shield: '<path d="M12 22s7-3 8-10V5l-8-3-8 3v7c1 7 8 10 8 10Z"/><path d="m12 7 1.3 3.4 3.7 1.6-3.7 1.5L12 17l-1.3-3.5L7 12l3.7-1.6L12 7Z"/>',
  swords: '<path d="m14.5 17.5 3 3 3-3-3-3M13 19l6-6M3 3l4 .5L15 12l-3 3-8.5-8L3 3ZM9.5 17.5l-3 3-3-3 3-3M11 19l-6-6M14 8l3-4.5 4-.5-.5 4L17 10"/>',
  flag: '<path d="M4 22V3m0 2c6-5 10 4 16 0v11c-6 4-10-5-16 0"/>',
  book: '<path d="M4 19V5a2 2 0 0 1 2-2h14v18H6a2 2 0 0 1 0-4h14M8 7h8m-8 4h6"/>',
  settings: '<path d="M4 6h16M4 12h16M4 18h16M8 4v4m8 2v4m-6 2v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  star: '<path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2Z"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="m12 7 3 5-3 5-3-5 3-5Z"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
};

const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const fmt = number => number.toLocaleString();
const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const dateText = date => date ? dateFmt.format(new Date(`${date}T12:00:00`)) : 'Undated';
const makeDate = date => `<time datetime="${escape(date)}">${dateText(date)}</time>`;
const army = key => state.armies.find(item => item.id === key);
const activeArmy = () => army(state.activeArmyId) || state.armies[0];
const sortedBattles = () => [...state.battles].sort(Ledger.dateOrder);
const button = (label, action, { type = 'secondary', glyph, id, title } = {}) =>
  `<button class="button ${type}" type="button" data-action="${action}"${id ? ` data-id="${escape(id)}"` : ''}${title ? ` aria-label="${escape(title)}"` : ''}>${glyph ? icon(glyph) : ''}${escape(label)}</button>`;
const pageLink = (label, page) => `<a class="button link" href="#${page}">${escape(label)}</a>`;
const badge = (label, style = label.toLowerCase()) => `<span class="pill ${style}">${escape(label)}</span>`;
const add = (label, action) => button(label, action, { type: 'primary', glyph: 'plus' });
const tile = (glyph, color) => `<span class="tile${color ? ' warband' : ''}"${color ? ` style="--warband:${Ledger.validColor(color)}"` : ''}>${icon(glyph)}</span>`;
const empty = (title, copy, action = '') => `<div class="empty"><p><strong>${escape(title)}</strong></p>${copy ? `<p class="meta">${escape(copy)}</p>` : ''}${action ? `<div class="actions">${action}</div>` : ''}</div>`;
const section = (title, body, actions = '') => `<section class="panel"><div class="panel-head"><h2>${escape(title)}</h2>${actions}</div>${body}</section>`;
const heading = (title, subtitle, actions = '') => `<div class="page-head"><div><h1>${escape(title)}</h1>${subtitle ? `<p class="meta">${escape(subtitle)}</p>` : ''}</div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
const span = (label, value) => value ? `<p class="meta copy"><span class="detail-label">${escape(label)}</span> · ${escape(value)}</p>` : '';
const signed = value => `<span class="${value >= 0 ? 'positive' : 'negative'}">${Ledger.signed(value)}</span>`;

let state;
let savedValue = null;
let storageOK = true;
let storageConflict = false;
let loadedLegacy = false;
let toastTimer;
let editor;
let lastFocus;
let filters = { query: '', army: '', result: '' };

try {
  savedValue = localStorage.getItem(storageKey);
  const legacyValue = savedValue === null ? localStorage.getItem(legacyKey) : null;
  const stored = savedValue ?? legacyValue;
  state = stored === null ? Ledger.sample() : Ledger.normalize(JSON.parse(stored));
  loadedLegacy = legacyValue !== null;
} catch {
  state = Ledger.sample();
  storageOK = false;
}

function tell(message, error = false) {
  toast.classList.toggle('error', error);
  toast.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.textContent = ''; }, 5200);
}

function save() {
  try {
    if (localStorage.getItem(storageKey) !== savedValue) {
      storageConflict = true;
      throw new Error('Campaign changed in another tab.');
    }
    const value = JSON.stringify(state);
    localStorage.setItem(storageKey, value);
    savedValue = value;
    storageOK = true;
    loadedLegacy = false;
  } catch {
    storageOK = false;
  }
  return storageOK;
}

function commit(message, page) {
  const saved = save();
  if (page && currentPage() !== page) location.hash = page;
  else render();
  if (saved) tell(message);
  else tell(storageConflict ? 'Another tab changed this campaign. Export your changes before reloading.' : 'Browser storage is unavailable. Export a backup to keep your changes.', true);
}

function currentPage() {
  const hash = location.hash.slice(1);
  return Object.hasOwn(pages, hash) ? hash : 'overview';
}

function overview() {
  const c = state.campaign;
  const active = state.armies.filter(item => !item.archived);
  const a = active.find(item => item.id === state.activeArmyId) || active[0];
  const activeQuests = active.flatMap(item => item.quests.filter(q => q.status === 'Active').map(q => ({ item, q })));
  const completed = active.reduce((sum, item) => sum + item.quests.filter(q => q.status === 'Completed').length, 0);
  const latest = sortedBattles().slice(0, 4);
  const cards = [
    ['shield', 'Warbands', active.length, `${active.reduce((sum, item) => sum + item.units.filter(u => u.status !== 'Retired').length, 0)} rostered units`],
    ['swords', 'Battles played', state.battles.length, a ? `${Ledger.record(state, a.id).Victory} wins for ${a.name}` : 'Campaign history'],
    ['coin', c.resource, a ? Ledger.balance(state, a) : 0, a ? a.name : 'Warband balance'],
    ['flag', 'Active quests', activeQuests.length, `${completed} completed`],
  ];
  const stats = cards.map(([glyph, title, number, caption]) => `<div class="stat"><div class="stat-head">${icon(glyph)}${escape(title)}</div><strong class="stat-value">${fmt(number)}</strong><p class="meta">${escape(caption)}</p></div>`).join('');
  const recent = latest.length ? latest.map(b => battleRow(b)).join('') : empty('No battles recorded', 'Log the first result and its aftermath.', a ? add('Record battle', 'new-battle') : '');
  const quests = activeQuests.length ? activeQuests.slice(0, 4).map(({ item, q }) => `<div class="list-item"><button type="button" class="list-button row" data-action="quest-warband" data-id="${escape(item.id)}">${tile('flag')}<span class="row-main"><strong class="row-title">${escape(q.title)}</strong><span class="meta row-sub">${escape(item.name)}</span></span></button>${questProgress(q)}</div>`).join('') : empty('No active quests', 'Give a warband a campaign objective.');
  const start = !a ? add('Create warband', 'new-warband') : add('Record battle', 'new-battle');
  return `<section class="hero"><div class="hero-content"><div class="hero-kicker">${escape(c.pack)}${state.sample ? badge('Sample campaign', 'sample') : ''}</div><h1>${escape(c.name)}</h1>${c.location ? `<p class="meta">${escape(c.location)}</p>` : ''}<div class="actions">${start}${state.sample ? button('Start my campaign', 'start') : ''}</div></div></section>
    <div class="stats">${stats}</div>
    <div class="layout overview-layout"><div class="stack">${section('Recent battles', recent, pageLink('All battles', 'battles'))}${section('Warbands', active.length ? active.map(item => warbandRow(item, 'go-warband')).join('') : empty('No active warbands', 'Create or restore a warband.'), pageLink('View warbands', 'warbands'))}</div>
    <div class="stack">${section('Active quests', quests, pageLink('All quests', 'quests'))}${c.notes ? section('Campaign notes', `<p class="copy muted">${escape(c.notes)}</p>`) : ''}</div></div>`;
}

function warbandRow(a, action, selected = false) {
  return `<div class="list-item"><button class="list-button row" type="button" data-action="${action}" data-id="${escape(a.id)}"${selected ? ' aria-current="true"' : ''}>${tile('shield', a.color)}<span class="row-main"><strong class="row-title">${escape(a.name)}</strong><span class="meta row-sub">${escape([a.faction, `${fmt(Ledger.points(a))} pts`].filter(Boolean).join(' · '))}</span></span>${a.archived ? badge('Archived', 'retired') : ''}</button></div>`;
}

function warbands() {
  const title = heading('Warbands', 'Order of battle, unit progression, and resource ledgers.', button('Profile library', 'profile-library', { glyph: 'book' }) + add('New warband', 'new-warband'));
  const a = activeArmy();
  if (!a) return title + empty('No warbands yet', 'Create a warband to start tracking a roster and its progress.');
  const rec = Ledger.record(state, a.id);
  const points = Ledger.points(a);
  const cap = state.campaign.pointsLimit;
  const selector = section('Campaign warbands', state.armies.map(item => warbandRow(item, 'select-warband', item.id === a.id)).join(''));
  const summary = `<section class="panel stack"><div class="split">${tile('shield', a.color)}<div class="row-main"><h2>${escape(a.name)}</h2><p class="meta">${escape(a.faction)}</p></div>${a.archived ? badge('Archived', 'retired') : ''}</div>
    <div class="facts meta"><span><strong class="${points > cap ? 'negative' : ''}">${fmt(points)} / ${fmt(cap)}</strong> roster pts</span><span><strong>${rec.Victory}–${rec.Defeat}–${rec.Draw}</strong> W–L–D</span>${a.warlord ? `<span>Warlord · <strong>${escape(a.warlord)}</strong></span>` : ''}</div>
    <progress class="progress" max="${cap}" value="${Math.min(points, cap)}" aria-label="Roster points reference"></progress>
    ${a.notes ? `<p class="copy muted">${escape(a.notes)}</p>` : ''}<div class="actions">${button('Edit warband', 'edit-warband')}${button(a.archived ? 'Restore warband' : 'Archive warband', 'archive-warband', { type: 'link' })}</div></section>`;
  const units = a.units.length ? `<div class="cards">${a.units.map(unit => unitCard(a, unit)).join('')}</div>` : empty('No units on the roster', 'Add a unit to track its points, Path, and Renown.');
  const transactions = Ledger.transactions(state, a);
  const history = transactions.length ? `<div class="table-scroll"><table><thead><tr><th>Date</th><th>Reason</th><th>Change</th><th>Action</th></tr></thead><tbody>${transactions.map(t => `<tr><td class="nowrap">${makeDate(t.date)}</td><td>${escape(t.reason)}</td><td>${signed(t.delta)}</td><td>${t.manual ? button('Edit', 'edit-resource', { id: t.id }) : button('View battle', 'view-battle', { id: t.id, type: 'link' })}</td></tr>`).join('')}</tbody></table></div>` : empty('No resource changes', 'Battle rewards and manual adjustments appear here.');
  const datacardActions = a.units.length ? button('View datacards', 'view-datacards') + button('Export datacards', 'export-datacards', { glyph: 'download' }) : '';
  const rosterActions = `<div class="actions">${datacardActions}${add('Add unit', 'new-unit')}</div>`;
  return title + `<div class="layout roster-layout">${selector}<div class="stack">${summary}${section('Order of battle', units, rosterActions)}${section(`${state.campaign.resource} ledger`, `<p class="meta" style="margin-bottom:12px">Current balance <strong class="gold">${fmt(Ledger.balance(state, a))}</strong></p>${history}`, button('Adjust balance', 'new-resource'))}</div></div>`;
}

function unitCard(a, unit) {
  const renown = unitRenown(a, unit, state.battles);
  const entry = unitCatalogueEntry(a, unit);
  const profile = unitProfile(a, unit, entry);
  const size = unit.size ?? entry?.size;
  return `<article class="card"><div class="split"><h3>${escape(unit.name)}</h3>${badge(unit.status)}</div><p class="meta">${escape(unit.warscroll || unit.type)} · ${fmt(unit.points)} pts</p>
    <p class="facts meta">${size ? `<span><strong>${fmt(size)}</strong> ${size === 1 ? 'model' : 'models'}</span>` : ''}<span><strong>${fmt(renown)}</strong> Renown</span>${unit.rank ? `<span>${escape(unit.rank)}</span>` : ''}${unit.path ? `<span>${escape(unit.path)}</span>` : ''}</p>
    ${span('Enhancements', unit.enhancements)}${span('Scars', unit.scars)}${unit.notes ? `<p class="meta copy">${escape(unit.notes)}</p>` : ''}
    ${profile ? `<p class="meta">${Object.entries(Ledger.profileStats).filter(([key]) => profile[key]).map(([key, label]) => `${escape(profile[key])} ${label}`).join(' · ')}</p>` : ''}
    <div class="actions">${button('Datacard', 'view-unit-datacard', { id: unit.id, title: `View ${unit.name} datacard` })}${button('Edit', 'edit-unit', { id: unit.id })}${button('Renown history', 'unit-history', { id: unit.id, type: 'link' })}</div></article>`;
}

function battleRow(b) {
  const first = army(b.armyId)?.name || 'Unknown warband';
  const second = army(b.opponentArmyId)?.name || b.opponent || 'External opponent';
  const result = Ledger.resultFor(b, filters.army && currentPage() === 'battles' ? filters.army : b.armyId);
  return `<div class="list-item"><button type="button" class="list-button row" data-action="view-battle" data-id="${escape(b.id)}">${tile('swords')}<span class="row-main"><strong class="row-title">${escape(b.title)}</strong><span class="meta row-sub">${escape(first)} vs ${escape(second)} · ${makeDate(b.date)}</span></span>${badge(result)}</button></div>`;
}

function battles() {
  return heading('Battles', 'Results, resource changes, and unit Renown awards.', state.armies.some(a => !a.archived) ? add('Record battle', 'new-battle') : '') + section('Battle record',
    `<div class="filter-row" id="battle-filters">${field('Search', 'query', filters.query, { placeholder: 'Search battles', type: 'search' })}${select('Warband', 'army', [['', 'All warbands'], ...armyOptions()], filters.army)}${select('Result', 'result', [['', 'All results'], ...Ledger.resultOptions], filters.result)}</div><div id="battle-results">${battleResults()}</div>`);
}

function battleResults() {
  const search = filters.query.toLowerCase().trim();
  const rows = sortedBattles().filter(b => {
    if (filters.army && !Ledger.participants(b).includes(filters.army)) return false;
    if (filters.result && Ledger.resultFor(b, filters.army || b.armyId) !== filters.result) return false;
    return !search || [b.title, b.battleplan, b.opponent, b.notes, ...Ledger.participants(b).map(id => army(id)?.name)].some(v => v?.toLowerCase().includes(search));
  });
  if (rows.length) return rows.map(battleRow).join('');
  if (state.battles.length) return empty('No matching battles', 'Try a different search or filter.');
  return empty('No battles yet', state.armies.some(a => !a.archived) ? 'Record your first result to start the battle history.' : 'Create or restore a warband before recording a battle.');
}

function questProgress(q) {
  if (!q.target) return '';
  return `<div class="progress-caption meta"><span>Progress</span><strong>${fmt(q.progress)} / ${fmt(q.target)}</strong></div><progress class="progress" max="${q.target}" value="${Math.min(q.progress, q.target)}" aria-label="${escape(q.title)} progress"></progress>`;
}

function quests() {
  const a = activeArmy();
  const title = heading('Quests', 'Objectives and rewards by warband.', a ? add('Add quest', 'new-quest') : '');
  if (!a) return title + empty('No warbands yet', 'Create a warband to start tracking quests.', pageLink('View warbands', 'warbands'));
  const selector = section('Warband', select('Campaign warband', 'quest-warband', armyOptions(), a.id));
  const groups = Ledger.questStatuses.map(status => {
    const items = a.quests.filter(q => q.status === status);
    if (!items.length && status !== 'Active') return '';
    return section(`${status} quests`, items.length ? `<div class="cards">${items.map(q => `<article class="card"><div class="split"><h3>${escape(q.title)}</h3>${badge(q.status)}</div>${q.goal ? `<p class="copy muted">${escape(q.goal)}</p>` : ''}${questProgress(q)}${span('Reward', q.reward)}${q.notes ? `<p class="meta copy">${escape(q.notes)}</p>` : ''}<div class="actions">${button('Edit quest', 'edit-quest', { id: q.id })}${q.status === 'Active' ? button('Mark complete', 'complete-quest', { id: q.id, type: 'link' }) : ''}</div></article>`).join('')}</div>` : empty('No active quests', 'Add an objective for this warband.'));
  }).join('');
  return title + `<div class="layout roster-layout">${selector}<div class="stack">${groups}</div></div>`;
}

function chronicle() {
  const entries = [...state.entries].sort(Ledger.dateOrder);
  return heading('Chronicle', 'The story of your campaign.', add('Write entry', 'new-entry')) + section('Campaign entries',
    entries.length ? entries.map(entry => `<article class="book-entry"><div class="split"><div><h3>${escape(entry.title)}</h3><p class="meta row-sub">${makeDate(entry.date)} · ${escape(army(entry.armyId)?.name || 'Campaign-wide')}</p></div>${button('Edit', 'edit-entry', { id: entry.id })}</div><p class="copy">${escape(entry.body)}</p></article>`).join('') : empty('No chronicle entries yet', 'Record a turning point, a rivalry, or a deed worth remembering.'));
}

function settings() {
  const c = state.campaign;
  return heading('Settings', 'Campaign details and backups.') + `<div class="stack setting-panels">
    ${section('Campaign details', `<form id="settings-form" class="form-grid">${campaignFields(c)}<div class="actions full"><button type="submit" class="button primary">Save campaign details</button></div></form>`)}
    ${section('Your data', `<p class="copy muted">Campaign records are stored in this browser. Export a JSON backup to keep a copy or move the campaign to another browser.</p><div class="actions" style="margin-top:13px">${button('Export backup', 'export', { glyph: 'download' })}${button('Import backup', 'import')}${button('Print overview', 'print')}</div>`)}
    ${section('Start over', `<p class="copy muted">Starting a new campaign replaces the current record in this browser.</p><div class="actions" style="margin-top:13px">${button('Start new campaign', 'start', { type: 'danger' })}</div>`)}</div>`;
}

function render() {
  const page = currentPage();
  document.querySelector('#nav').innerHTML = Object.entries(pages).map(([key, [label, glyph]]) => `<a class="nav-link" href="#${key}"${page === key ? ' aria-current="page"' : ''}>${icon(glyph)}${label}</a>`).join('');
  document.querySelector('#topbar').innerHTML = `<div class="crumb"><span>Campaign</span><span aria-hidden="true">/</span><strong>${pages[page][0]}</strong></div>${button('Export backup', 'export', { glyph: 'download' })}`;
  const status = !storageOK ? 'Changes need a backup' : state.sample && savedValue === null ? 'Sample campaign' : 'Saved in this browser';
  document.querySelector('#sidebar-bottom').innerHTML = `${state.sample && page !== 'overview' ? button('Start my campaign', 'start') : ''}<p class="save-info${storageOK ? '' : ' unsaved'}">${escape(status)}</p>`;
  main.innerHTML = { overview, warbands, battles, quests, chronicle, settings }[page]();
  document.title = `${pages[page][0]} · Path to Glory`;
}

function armyOptions(list = state.armies) {
  return list.map(a => [a.id, `${a.name}${a.archived ? ' (archived)' : ''}`]);
}

function field(label, key, value = '', { type = 'text', placeholder = '', required = false, min, maxLength = 160, full = false, disabled = false, list } = {}) {
  return `<div class="field${full ? ' full' : ''}"><label for="field-${key}">${escape(label)}</label><input id="field-${key}" name="${key}" value="${escape(value)}" type="${type}"${required ? ' required' : ''}${disabled ? ' disabled' : ''}${min !== undefined ? ` min="${min}"` : ''}${type === 'number' ? ' step="1"' : ''}${type === 'text' ? ` maxlength="${maxLength}"` : ''}${placeholder ? ` placeholder="${escape(placeholder)}"` : ''}${list ? ` list="${list}"` : ''}></div>`;
}

function select(label, key, options, value) {
  const items = options.map(option => {
    const [id, name] = Array.isArray(option) ? option : [option, option];
    return `<option value="${escape(id)}"${id === value ? ' selected' : ''}>${escape(name)}</option>`;
  }).join('');
  return `<div class="field"><label for="field-${key}">${escape(label)}</label><select id="field-${key}" name="${key}">${items}</select></div>`;
}

function area(label, key, value, rows = 3, required = false) {
  return `<div class="field full"><label for="field-${key}">${escape(label)}</label><textarea id="field-${key}" name="${key}" rows="${rows}"${required ? ' required' : ''}>${escape(value)}</textarea></div>`;
}

function campaignFields(c) {
  const packs = [...Ledger.packs.keys()];
  if (!packs.includes(c.pack)) packs.push(c.pack);
  return field('Campaign name', 'name', c.name, { required: true }) + select('Battlepack', 'pack', packs, c.pack) + field('Region', 'location', c.location) +
    field('Resource name', 'resource', c.resource) + field('Roster points reference', 'pointsLimit', c.pointsLimit, { type: 'number', min: 1, required: true }) + area('Campaign notes and house rules', 'notes', c.notes, 4);
}

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

function required(value, label) {
  const text = value?.trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function whole(value, label, min = -Infinity) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min) throw new Error(`${label} needs a valid whole number.`);
  return number;
}

function campaignValues(v) {
  return { name: required(v.name, 'Campaign name'), pack: v.pack, location: v.location.trim(), resource: v.resource.trim() || Ledger.packs.get(v.pack) || Ledger.packs.get('Custom'), pointsLimit: whole(v.pointsLimit, 'Roster points reference', 1), notes: v.notes.trim() };
}

function startCampaign() {
  formDialog('Start a new campaign', campaignFields({ ...Ledger.blank().campaign, name: '' }), v => {
    state = { ...Ledger.blank(), campaign: campaignValues(v) };
    filters = { query: '', army: '', result: '' };
    return ['Campaign created.', 'overview'];
  }, { label: 'Start campaign', description: state.sample && savedValue === null ? 'Set up your campaign after exploring the sample.' : 'This replaces the current campaign in this browser. Export a backup first to keep a copy.' });
}

function warbandForm(existing) {
  const a = existing || {};
  formDialog(existing ? 'Edit warband' : 'New warband', field('Warband name', 'name', a.name, { required: true }) + field('Faction', 'faction', a.faction, { required: true, list: 'faction-options', placeholder: 'Choose or enter a faction' }) + datalist('faction-options', BattleCatalogue.factions) +
    field('Warlord or general', 'warlord', a.warlord) + field('Banner color', 'color', Ledger.validColor(a.color), { type: 'color' }) + area('Warband notes', 'notes', a.notes), v => {
    const values = { name: required(v.name, 'Warband name'), faction: required(v.faction, 'Faction'), warlord: v.warlord.trim(), notes: v.notes.trim(), color: Ledger.validColor(v.color) };
    if (existing) Object.assign(existing, values);
    else {
      const id = Ledger.id();
      state.armies.push({ id, ...values, archived: false, units: [], quests: [], ledger: [] });
      state.activeArmyId = id;
    }
    return ['Warband saved.', 'warbands'];
  }, { label: existing ? 'Save warband' : 'Create warband' });
}

function datalist(id, values) {
  return `<datalist id="${id}">${values.map(value => `<option value="${escape(value)}"></option>`).join('')}</datalist>`;
}

function unitForm(a, existing) {
  const u = existing || {};
  const history = existing ? Ledger.battleRenown(state, a.id, u.id) : 0;
  const categories = [...new Set([...Ledger.categories, u.type || 'Infantry'])];
  const remove = existing ? button('Remove unit', 'remove-unit', { id: u.id, type: 'danger' }) : '';
  const catalogue = BattleCatalogue.list(a.faction);
  const profileOptions = datalist('roster-profiles', catalogue.map(entry => entry.name));
  const entry = existing && unitCatalogueEntry(a, existing);
  const initialProfile = existing ? referenceUnitProfile(a, u, entry) : undefined;
  let profileEditor;
  formDialog(existing ? `Edit ${u.name}` : `Add unit to ${a.name}`,
    field('Warscroll', 'warscroll', u.warscroll, { list: 'roster-profiles', placeholder: 'Choose a profile or enter a name' }) + profileOptions + field('Unit name', 'name', u.name, { required: true }) +
    `<div class="full" id="unit-catalogue-values" hidden><div class="actions"><p class="meta" id="unit-catalogue-summary"></p><button type="button" class="button secondary" id="apply-unit-catalogue">Apply listed values</button></div></div>` +
    select('Category', 'type', categories, u.type || 'Infantry') + field('Points', 'points', u.points ?? 0, { type: 'number', min: 0 }) +
    field('Unit size (models)', 'size', u.size ?? entry?.size ?? '', { type: 'number', min: 1 }) + field('Base Renown', 'renown', u.renown ?? 0, { type: 'number', min: 0 }) +
    select('Status', 'status', Ledger.unitStatuses, u.status || 'Active') + field('Rank', 'rank', u.rank) + field('Path', 'path', u.path) +
    profileEditorFields(!initialProfile) + area('Enhancement notes', 'enhancements', u.enhancements) + area('Scars and injuries', 'scars', u.scars) + area('Unit notes', 'notes', u.notes), v => {
    const { type, status, rank, path, enhancements, scars, notes } = v;
    const values = { type, status, rank, path, enhancements, scars, notes, name: required(v.name, 'Unit name'), warscroll: v.warscroll.trim(), points: whole(v.points, 'Points', 0),
      size: v.size === '' ? null : whole(v.size, 'Unit size', 1), renown: whole(v.renown, 'Base Renown', 0), profileEdits: profileEditor.changes() };
    if (existing) Object.assign(existing, values);
    else a.units.push({ id: Ledger.id(), ...values });
    return ['Unit saved.', 'warbands'];
  }, { label: 'Save unit', remove, description: history ? `Battle history contributes ${Ledger.signed(history)} Renown to this unit’s total.` : 'Use base Renown for progress earned before you began logging battles here.' });
  const form = dialog.querySelector('#editor-form');
  const fields = form.elements;
  profileEditor = attachProfileEditor(form, initialProfile, u.profileEdits);
  let suggestedName = '';
  const selected = () => unitCatalogueEntry(a, { warscroll: fields.warscroll.value, name: fields.name.value });
  const apply = record => {
    if (!record) return;
    fields.warscroll.value = record.name;
    if (!fields.name.value.trim() || fields.name.value === suggestedName) {
      fields.name.value = record.name;
      suggestedName = record.name;
    }
    fields.type.value = record.category;
    fields.points.value = record.points;
    fields.size.value = record.size;
  };
  const refreshReference = () => {
    const current = { warscroll: fields.warscroll.value, name: fields.name.value };
    const record = unitCatalogueEntry(a, current);
    profileEditor.rebase(referenceUnitProfile(a, current, record));
    form.querySelector('#unit-catalogue-values').hidden = !record;
    form.querySelector('#unit-catalogue-summary').textContent = record ? `${fmt(record.points)} listed points · ${modelCount(record.size)}${record.kind ? ` · ${record.kind}` : ''}` : '';
  };
  fields.warscroll.addEventListener('change', () => {
    if (!existing) apply(selected());
    refreshReference();
  });
  fields.name.addEventListener('change', refreshReference);
  form.querySelector('#apply-unit-catalogue').addEventListener('click', () => { apply(selected()); refreshReference(); });
  refreshReference();
}

function unitHistory(a, u) {
  const history = Ledger.unitHistory(state, a.id, u.id);
  const total = u.renown + history.reduce((sum, award) => sum + award.delta, 0);
  const list = history.map(row => `<div class="list-item split"><div><strong>${escape(row.title)}</strong><p class="meta">${makeDate(row.date)}</p></div>${signed(row.delta)}</div>`).join('');
  viewDialog(`${u.name} · Renown`, `<p><strong class="gold">${fmt(total)}</strong> total Renown</p><p class="meta">Base Renown · ${fmt(u.renown)}</p>${list || empty('No battle awards yet', '')}`);
}

function resourceForm(a, existing) {
  const row = existing || {};
  formDialog(existing ? 'Edit adjustment' : `Adjust ${state.campaign.resource}`,
    field('Date', 'date', row.date || Ledger.date(), { type: 'date', required: true }) + field('Change', 'delta', row.delta ?? 0, { type: 'number', required: true }) +
    field('Reason', 'reason', row.reason, { required: true, full: true }), v => {
    const values = { date: v.date, reason: required(v.reason, 'Reason'), delta: whole(v.delta, 'Change') };
    if (!values.delta) throw new Error('Enter a gain or expenditure greater than zero.');
    if (existing) Object.assign(existing, values);
    else a.ledger.push({ id: Ledger.id(), ...values });
    return ['Resource adjustment saved.', 'warbands'];
  }, { label: 'Save adjustment', description: 'Use a positive number for gains and a negative number for spending.', remove: existing ? button('Delete adjustment', 'remove-resource', { id: row.id, type: 'danger' }) : '' });
}

function questForm(a, existing) {
  const q = existing || {};
  formDialog(existing ? 'Edit quest' : `Add quest for ${a.name}`, field('Quest name', 'title', q.title, { required: true }) + select('Status', 'status', Ledger.questStatuses, q.status || 'Active') +
    area('Objective', 'goal', q.goal) + field('Target (optional)', 'target', q.target || '', { type: 'number', min: 1 }) + field('Progress', 'progress', q.progress ?? 0, { type: 'number', min: 0 }) +
    area('Reward', 'reward', q.reward) + area('Notes', 'notes', q.notes), v => {
    const values = { ...v, title: required(v.title, 'Quest name'), target: whole(v.target, 'Target', 0), progress: whole(v.progress, 'Progress', 0) };
    if (values.target && values.progress > values.target) throw new Error('Progress cannot exceed the target.');
    if (values.status === 'Completed' && values.target) values.progress = values.target;
    if (existing) Object.assign(existing, values);
    else a.quests.push({ id: Ledger.id(), ...values });
    return ['Quest saved.', 'quests'];
  }, { label: 'Save quest', remove: existing ? button('Delete quest', 'remove-quest', { id: q.id, type: 'danger' }) : '' });
}

function entryForm(existing) {
  const j = existing || {};
  formDialog(existing ? 'Edit chronicle entry' : 'Write a chronicle entry',
    field('Title', 'title', j.title, { full: true, required: true }) + field('Date', 'date', j.date || Ledger.date(), { type: 'date', required: true }) +
    select('Warband', 'armyId', [['', 'Campaign-wide'], ...armyOptions()], j.armyId || '') + area('Entry', 'body', j.body, 7, true), v => {
    const values = { ...v, title: required(v.title, 'Title'), body: required(v.body, 'Entry') };
    if (existing) Object.assign(existing, values);
    else state.entries.push({ id: Ledger.id(), ...values });
    return ['Chronicle entry saved.', 'chronicle'];
  }, { label: 'Save entry', remove: existing ? button('Delete entry', 'remove-entry', { id: j.id, type: 'danger' }) : '' });
}

function battleForm(existing) {
  const b = existing || {};
  const c = state.campaign;
  const eligible = state.armies.filter(a => !a.archived || (existing && Ledger.participants(b).includes(a.id)));
  const primary = b.armyId || eligible.find(a => a.id === state.activeArmyId)?.id || eligible[0]?.id;
  if (!primary) {
    tell('Create or restore a warband to record a battle.', true);
    return;
  }
  const firstOptions = armyOptions(eligible);
  if (b.armyId && !army(b.armyId)) firstOptions.push([b.armyId, 'Unknown warband']);
  const drafts = new Map();
  const awardKey = (armyId, unitId) => JSON.stringify([armyId, unitId]);
  for (const award of b.awards || []) drafts.set(awardKey(award.armyId, award.unitId), award);

  function refreshParticipants(form) {
    const fields = form.elements;
    for (const input of form.querySelectorAll('[data-award]')) {
      const key = awardKey(input.dataset.army, input.dataset.unit);
      const { army: armyId, unit: unitId } = input.dataset;
      drafts.set(key, { id: drafts.get(key)?.id || Ledger.id(), armyId, unitId, unitName: input.dataset.name, delta: input.value });
    }

    const yourArmy = fields.armyId.value;
    const opponent = fields.opponentArmyId.value;
    const options = [['', 'External opponent'], ...armyOptions(eligible.filter(a => a.id !== yourArmy))];
    if (b.opponentArmyId && !army(b.opponentArmyId) && b.opponentArmyId !== yourArmy) options.push([b.opponentArmyId, 'Unknown warband']);
    fields.opponentArmyId.replaceChildren(...options.map(([key, label]) => new Option(label, key)));
    fields.opponentArmyId.value = options.some(([key]) => key === opponent) ? opponent : '';
    fields.opponent.disabled = Boolean(fields.opponentArmyId.value);
    fields.oppDelta.disabled = !fields.opponentArmyId.value;

    const ids = [yourArmy, fields.opponentArmyId.value].filter(Boolean);
    let index = 0;
    form.querySelector('#battle-awards').innerHTML = ids.map(id => {
      const a = army(id);
      const units = new Map((a?.units || []).filter(u => u.status !== 'Retired' || drafts.has(awardKey(id, u.id))).map(u => [u.id, u.name]));
      for (const award of drafts.values()) if (award.armyId === id && !units.has(award.unitId)) units.set(award.unitId, award.unitName || 'Removed unit');
      if (!units.size) return '';
      const rows = [...units].map(([unitId, name]) => {
        const previous = drafts.get(awardKey(id, unitId));
        const fieldId = `award-${++index}`;
        return `<div class="award-input"><label for="${fieldId}">${escape(name)}</label><input id="${fieldId}" name="${fieldId}" type="number" min="0" step="1" value="${escape(previous?.delta || '')}" placeholder="0" data-award data-army="${escape(id)}" data-unit="${escape(unitId)}" data-name="${escape(name)}"></div>`;
      }).join('');
      return `<div class="award-group"><h3>${escape(a?.name || 'Unknown warband')}</h3>${rows}</div>`;
    }).join('') || '<p class="meta">Add units to the participating warbands to log Renown here.</p>';
  }

  const fields = field('Battle title', 'title', b.title, { full: true, required: true }) + field('Date', 'date', b.date || Ledger.date(), { type: 'date', required: true }) +
    field('Battleplan', 'battleplan', b.battleplan) + select('Warband', 'armyId', firstOptions, primary) + select('Opponent warband', 'opponentArmyId', [['', 'External opponent'], ...armyOptions(eligible), ...(b.opponentArmyId && !army(b.opponentArmyId) ? [[b.opponentArmyId, 'Unknown warband']] : [])], b.opponentArmyId || '') +
    field('External opponent name', 'opponent', b.opponent) + select('Result for selected warband', 'result', Ledger.resultOptions, b.result || 'Victory') +
    field(`Warband ${c.resource} change`, 'delta', b.delta ?? 0, { type: 'number' }) + field(`Opponent ${c.resource} change`, 'oppDelta', b.oppDelta ?? 0, { type: 'number' }) +
    `<fieldset class="awards full"><legend>Unit Renown awards</legend><p class="meta">Enter the Renown each unit earned in this battle.</p><div id="battle-awards"></div></fieldset>` + area('Aftermath notes', 'notes', b.notes, 4);
  formDialog(existing ? 'Edit battle' : 'Record battle', fields, (v, form) => {
    if (v.opponentArmyId === v.armyId) throw new Error('Choose a different opponent warband.');
    const awards = [...form.querySelectorAll('[data-award]')].flatMap(input => {
      const delta = whole(input.value, 'Renown award', 0);
      if (!delta) return [];
      const { army: armyId, unit: unitId, name: unitName } = input.dataset;
      return [{ id: drafts.get(awardKey(armyId, unitId))?.id || Ledger.id(), armyId, unitId, unitName, delta }];
    });
    const values = { title: required(v.title, 'Battle title'), date: v.date, armyId: v.armyId, opponentArmyId: v.opponentArmyId, opponent: v.opponent?.trim() || '',
      result: v.result, battleplan: v.battleplan.trim(), notes: v.notes.trim(), delta: whole(v.delta, 'Warband resource change'), oppDelta: whole(v.oppDelta ?? 0, 'Opponent resource change'), awards };
    if (existing) Object.assign(existing, values);
    else state.battles.push({ id: Ledger.id(), ...values });
    filters = { query: '', army: '', result: '' };
    return ['Battle saved.', 'battles'];
  }, { label: 'Save battle', remove: existing ? button('Delete battle', 'remove-battle', { id: b.id, type: 'danger' }) : '' });

  const form = dialog.querySelector('form');
  refreshParticipants(form);
  form.addEventListener('change', event => {
    if (['armyId', 'opponentArmyId'].includes(event.target.name)) refreshParticipants(form);
  });
}

function viewBattle(b) {
  const first = army(b.armyId)?.name || 'Unknown warband';
  const second = army(b.opponentArmyId)?.name || b.opponent || 'External opponent';
  const awards = b.awards.map(a => {
    const owner = army(a.armyId);
    const name = owner?.units.find(u => u.id === a.unitId)?.name || a.unitName || 'Removed unit';
    return `<div class="list-item split"><p>${escape(name)} <span class="meta">${escape(owner?.name || '')}</span></p><p class="nowrap">${signed(a.delta)} Renown</p></div>`;
  }).join('');
  viewDialog(b.title, `<div class="split"><p class="meta">${makeDate(b.date)}${b.battleplan ? ` · ${escape(b.battleplan)}` : ''}</p>${badge(b.result)}</div>
    <p><strong>${escape(first)}</strong> vs ${escape(second)}</p><p class="meta">${escape(state.campaign.resource)} · ${escape(first)} ${signed(b.delta)}${b.opponentArmyId ? ` · ${escape(second)} ${signed(b.oppDelta)}` : ''}</p>${b.notes ? `<p class="copy">${escape(b.notes)}</p>` : ''}
    ${awards ? `<div><h3>Unit Renown awards</h3>${awards}</div>` : ''}`, button('Edit battle', 'edit-battle', { id: b.id, type: 'primary' }));
}

function downloadFile(filename, contents, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function exportBackup() {
  downloadFile(`path-to-glory-${Ledger.date()}.json`, JSON.stringify(state, null, 2), 'application/json');
  tell('Backup downloaded.');
}

const unitRenown = (warband, unit, battles) => unit.renown + Ledger.battleRenown({ battles }, warband.id, unit.id);
const unitWarscroll = unit => unit.warscroll?.trim() || unit.name?.trim();
function unitCatalogueEntry(warband, unit) {
  const name = unitWarscroll(unit);
  const canonical = BattleCatalogue.groupName(warband.faction) === 'Khazalite Holds' ? WarbandProfiles.find(name)?.name : undefined;
  return BattleCatalogue.find(warband.faction, canonical || name);
}
const catalogueProfile = entry => entry.profile || (entry.faction === 'Khazalite Holds' ? WarbandProfiles.find(entry.name) : undefined);
function referenceUnitProfile(warband, unit, entry) {
  if (entry) return catalogueProfile(entry);
  if (BattleCatalogue.groupName(warband.faction) === 'Khazalite Holds') return WarbandProfiles.find(unitWarscroll(unit));
}

function unitProfile(warband, unit, entry) {
  const reference = referenceUnitProfile(warband, unit, entry);
  const edits = unit.profileEdits;
  if (!edits) return reference;
  return { ...reference, ...edits.stats, melee: edits.melee ?? reference?.melee, ranged: edits.ranged ?? reference?.ranged,
    abilityDetails: Ledger.profileAbilityEdits(reference, edits) ?? reference?.abilityDetails, customized: true };
}
const modelCount = size => `${fmt(size)} ${size === 1 ? 'model' : 'models'}`;
const cardFacts = pairs => pairs.filter(([, value]) => value !== '' && value != null)
  .map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('');

function weaponProfiles(title, rows, ranged = false) {
  if (!rows?.length) return '';
  const columns = (ranged ? [['Rng', 'Range']] : []).concat([['Atk', 'Attacks'], ['Hit', 'Hit'], ['Wnd', 'Wound'], ['Rnd', 'Rend'], ['Dmg', 'Damage']]);
  const head = columns.map(([label, full]) => `<th scope="col" aria-label="${full}">${label}</th>`).join('');
  const body = rows.map(([name, ...values]) => {
    const ability = values[columns.length];
    return `<tr><th scope="row">${escape(name)}${ability ? `<small>${escape(ability)}</small>` : ''}</th>${values.slice(0, columns.length).map(value => `<td>${escape(value)}</td>`).join('')}</tr>`;
  }).join('');
  return `<table class="dc-weapons"><caption>${title}</caption><thead><tr><th scope="col">Weapon</th>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function printChoice(label, name) {
  return `<label class="dc-print-choice"><input type="checkbox" checked aria-label="${escape(`${label}: ${name}`)}"> ${label}</label>`;
}

function abilityCard(ability, printControls) {
  const timing = ability.timing || '';
  const phase = timing.toLowerCase().match(/\b(hero|movement|shooting|charge|combat|deployment|passive|end)\b/)?.[1] || '';
  return `<section class="dc-ability" data-phase="${phase}">
    ${printControls ? printChoice('Print ability', ability.name) : ''}
    ${timing ? `<p class="dc-timing">${escape(timing)}</p>` : ''}
    <h3>${escape(ability.name)}</h3>
    ${ability.kind === 'Path upgrade' ? '<p class="dc-upgrade">Path upgrade</p>' : ''}
    ${ability.effect ? `<p class="dc-effect">${escape(ability.effect)}</p>` : ''}
  </section>`;
}

function profileContent(profile, printControls) {
  if (!profile) return '';
  const stats = cardFacts([...Object.entries(Ledger.profileStats).map(([key, label]) => [label, profile[key]]), ['Banishment', profile.banishment], ['Summon', profile.summon]]);
  const abilities = profile.abilityDetails?.map(ability => abilityCard(ability, printControls)).join('');
  const reference = profile.url ? `<a href="${escape(profile.url)}" target="_blank" rel="noopener noreferrer">Wahapedia warscroll</a> · ${profile.retrieved ? 'Retrieved ' + escape(profile.retrieved) : escape(BattleCatalogue.warscrollDate)}` : profile.page ? `${escape(WarbandProfiles.source)} · p. ${profile.page}` : '';
  return `${stats ? `<dl class="dc-stats">${stats}</dl>` : ''}${weaponProfiles('Ranged weapons', profile.ranged, true)}${weaponProfiles('Melee weapons', profile.melee)}
    ${abilities ?? (profile.abilities?.length ? `<section class="dc-detail"><h3>Ability reference</h3><p>${profile.abilities.map(escape).join(' · ')}</p></section>` : '')}
    ${profile.keywords?.length ? `<section class="dc-detail"><h3>Keywords</h3><p>${profile.keywords.map(escape).join(' · ')}</p></section>` : ''}
    ${profile.customized || reference ? `<p class="dc-source">${profile.customized ? 'Customized profile' : ''}${profile.customized && reference ? ' · Base profile from ' : ''}${reference}</p>` : ''}`;
}

function datacard(profile, unit, renown, entry, printControls = false) {
  const name = unit?.name || entry?.name || profile.name;
  const category = profile?.category || entry?.category || unit.type;
  const points = unit?.points ?? entry?.points;
  const size = unit?.size ?? entry?.size;
  const metrics = cardFacts([['Points', points === undefined ? '' : fmt(points)], ['Models', size ? fmt(size) : ''], ['Renown', unit ? fmt(renown) : '']]);
  const metainfo = unit ? cardFacts([['Warscroll', unit.warscroll || (profile?.name !== name ? profile?.name : '')], ['Rank', unit.rank], ['Path', unit.path]]) : '';
  const details = unit ? [['Enhancements and abilities', unit.enhancements], ['Scars and injuries', unit.scars], ['Unit notes', unit.notes]]
    .filter(([, value]) => value?.trim()).map(([label, value]) => `<section class="dc-detail"><h3>${label}</h3><p>${escape(value)}</p></section>`).join('') : '';
  return `<article class="datacard"${unit?.status === 'Retired' ? ' data-retired' : ''}>
    <header class="dc-title"><div><p class="dc-label">${[category, entry?.kind].filter(Boolean).map(escape).join(' · ')}</p><h2>${escape(name)}</h2></div>${unit ? `<span class="dc-status">${escape(unit.status)}</span>` : ''}</header>
    ${printControls ? printChoice('Print card', name) : ''}
    ${metrics ? `<dl class="dc-metrics">${metrics}</dl>` : ''}
    ${profileContent(profile, printControls)}
    ${metainfo ? `<dl class="dc-details">${metainfo}</dl>` : ''}${details}
    ${entry ? `<p class="dc-source">Battle Profiles · ${escape(BattleCatalogue.edition)} · p. ${entry.page}</p>` : ''}</article>`;
}

const datacardStyles = `
  .dc-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 14px; align-items: start; }
  .dc-cards h2, .dc-cards h3, .dc-cards p, .dc-cards dl, .dc-cards dd { margin: 0; overflow-wrap: anywhere; }
  .dc-cards .datacard { color: #192d29; background: #fffefa; border: 1px solid #839087; border-top: 5px solid var(--banner, #49665c); border-radius: 6px; padding: 14px; min-width: 0; }
  .dc-title { display: flex; justify-content: space-between; flex-wrap: wrap; align-items: start; gap: 7px; }
  .dc-title > div { min-width: 0; }
  .dc-title h2 { margin-top: 2px; font: 700 1.43rem/1.16 Georgia, serif; }
  .dc-status { border: 1px solid #81948a; border-radius: 4px; padding: 3px 7px; font-size: .75rem; font-weight: 700; }
  [data-retired] .dc-status { border-color: #787878; color: #444; }
  .dc-label, .dc-cards dt, .dc-detail h3, .dc-weapons caption { font: 750 .74rem/1.2 system-ui, sans-serif; text-transform: uppercase; letter-spacing: .045em; color: #3d5a50; }
  .dc-cards .dc-stats, .dc-cards .dc-metrics { display: grid; gap: 5px; margin-top: 12px; }
  .dc-stats { grid-template-columns: repeat(auto-fit, minmax(min(100%, 72px), 1fr)); }
  .dc-metrics { grid-template-columns: repeat(auto-fit, minmax(min(100%, 72px), 1fr)); }
  .dc-stats > div, .dc-metrics > div { border: 1px solid #b6c4b8; background: #ecf2ea; border-radius: 4px; padding: 5px 6px; }
  .dc-stats dd, .dc-metrics dd { font: 700 1.23rem/1.15 Georgia, serif; margin-top: 3px; }
  .dc-weapons { width: 100%; border-collapse: collapse; text-align: left; margin-top: 11px; font: .83rem/1.2 system-ui, sans-serif; }
  .dc-weapons caption { text-align: left; padding-bottom: 5px; }
  .dc-weapons th, .dc-weapons td { border: 1px solid #c6d0c5; padding: 4px; font-size: inherit; color: inherit; }
  .dc-weapons thead th { background: #ecf2ea; }
  .dc-weapons th:first-child { width: 100%; overflow-wrap: anywhere; }
  .dc-weapons td { text-align: center; white-space: nowrap; }
  .dc-weapons small { display: block; font-size: .72rem; font-weight: 500; }
  .dc-details { display: flex; flex-wrap: wrap; gap: 8px 15px; padding-top: 10px; font-size: .9rem; }
  .dc-detail { border-top: 1px solid #c6d0c5; padding-top: 7px; margin-top: 9px; }
  .dc-detail p { white-space: pre-wrap; margin-top: 3px; line-height: 1.36; font-size: .88rem; }
  .dc-ability { --phase-ink: #39574a; border: 1px solid #c6d0c5; border-inline-start: 3px solid var(--phase-ink); border-radius: 4px; padding: 8px 10px; margin-top: 10px; }
  .dc-ability[data-phase="shooting"], .dc-ability[data-phase="movement"] { --phase-ink: #285a76; }
  .dc-ability[data-phase="charge"], .dc-ability[data-phase="combat"] { --phase-ink: #813d31; }
  .dc-ability[data-phase="hero"], .dc-ability[data-phase="end"] { --phase-ink: #645081; }
  .dc-ability .dc-timing { color: var(--phase-ink); font-size: .76rem; font-weight: 750; margin-bottom: 3px; }
  .dc-ability h3 { font: 700 1rem/1.2 Georgia, serif; }
  .dc-ability .dc-upgrade { display: inline-block; border: 1px solid #a39777; color: #574824; border-radius: 3px; padding: 1px 4px; font-size: .74rem; margin-top: 5px; }
  .dc-ability .dc-effect { white-space: pre-wrap; margin-top: 5px; line-height: 1.36; font-size: .88rem; }
  .dc-cards .dc-source { font-size: .75rem; color: #3d5a50; margin-top: 8px; }
  .dc-source a { color: #244e40; text-decoration: underline; }
`;

function warbandCardList(warband, battles, { units = warband.units, printControls = false } = {}) {
  const cards = units.map(unit => {
    const entry = unitCatalogueEntry(warband, unit);
    return datacard(unitProfile(warband, unit, entry), unit, unitRenown(warband, unit, battles), entry, printControls);
  }).join('\n');
  return `<div class="dc-cards" style="--banner:${Ledger.validColor(warband.color)}">${cards}</div>`;
}

function viewWarbandDatacards(warband, unit) {
  viewDialog(unit ? `${unit.name} datacard` : `${warband.name} datacards`,
    `<style>${datacardStyles}</style>${warbandCardList(warband, state.battles, { units: unit ? [unit] : warband.units })}`,
    button('Export warband HTML', 'export-datacards', { glyph: 'download' }), !unit);
}

let libraryFilters;

function viewProfileLibrary(reset = false) {
  if (reset || !libraryFilters) {
    libraryFilters = { group: BattleCatalogue.groupName(activeArmy()?.faction) || 'Khazalite Holds', query: '' };
  }
  viewDialog('Unit profile library', `<style>${datacardStyles}</style>
    <p class="meta">Battle Profiles · ${escape(BattleCatalogue.edition)}. Datacards link to the matching warscroll source where available.</p>
    <div class="filter-row">${field('Search units', 'catalogue-query', libraryFilters.query, { type: 'search' })}${select('Faction or collection', 'catalogue-group', BattleCatalogue.groups, libraryFilters.group)}</div>
    <div id="catalogue-results"></div>`, '', true);
  const results = dialog.querySelector('#catalogue-results');
  const query = dialog.querySelector('#field-catalogue-query');
  const group = dialog.querySelector('#field-catalogue-group');
  const refresh = () => {
    libraryFilters = { group: group.value, query: query.value };
    results.innerHTML = libraryResults(libraryFilters);
  };
  query.addEventListener('input', refresh);
  group.addEventListener('change', refresh);
  refresh();
}

function libraryResults({ group, query }) {
  const term = query.trim().toLowerCase();
  const units = BattleCatalogue.list(group).filter(entry => entry.name.toLowerCase().includes(term));
  const rows = units.map(entry => `<tr>
    <td>${escape(entry.name)}${entry.kind ? `<span class="meta row-sub">${escape(entry.kind)}</span>` : ''}</td>
    <td>${fmt(entry.points)}</td><td>${modelCount(entry.size)}</td>
    <td>${button('View', 'view-catalogue-datacard', { id: entry.id, type: 'link', title: `View ${entry.name} datacard` })}</td></tr>`).join('');
  const references = group === 'Khazalite Holds' ? WarbandProfiles.references.filter(profile => profile.name.toLowerCase().includes(term)) : [];
  if (!rows && !references.length) return empty('No matching units', 'Try a different name or faction.');
  return `${rows ? `<div class="table-scroll"><table><thead><tr><th scope="col">Unit</th><th scope="col">Points</th><th scope="col">Unit size</th><th scope="col">Datacard</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}
    ${references.length ? `<section class="stack" style="margin-top:17px"><h3>Manifestations and faction terrain</h3><div class="dc-cards">${references.map(profile => datacard(profile)).join('')}</div></section>` : ''}`;
}

function viewCatalogueDatacard(id) {
  const entry = BattleCatalogue.get(id);
  if (!entry) return;
  viewDialog(`${entry.name} datacard`, `<style>${datacardStyles}</style><div class="dc-cards">${datacard(catalogueProfile(entry), null, null, entry)}</div>`, button('Back to profile library', 'back-to-profile-library'));
}

function warbandDatacards(campaign, warband, battles) {

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(warband.name)} · Campaign datacards</title>
<style>
  * { box-sizing: border-box; }
  :root { font-family: system-ui, sans-serif; color: #192d29; background: #eef1ea; }
  body { max-width: 1060px; margin: auto; padding: clamp(16px, 4vw, 44px); }
  h1, p { margin: 0; overflow-wrap: anywhere; }
  h1 { font-family: Georgia, serif; }
  .masthead { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 14px; padding: 0 0 19px; margin-bottom: 20px; border-bottom: 2px solid #48645b; }
  .masthead h1 { font-size: clamp(1.9rem, 5vw, 3.1rem); margin: 4px 0 6px; }
  .warband-facts { color: #354a42; line-height: 1.5; }
  button { align-self: start; font: inherit; font-weight: 650; color: #fff; padding: 9px 14px; border: 1px solid #25493f; border-radius: 5px; background: #25493f; cursor: pointer; }
  button:focus-visible { outline: 2px solid #25493f; outline-offset: 3px; }
  ${datacardStyles}
  .dc-print-hint { color: #354a42; margin-bottom: 14px; }
  .dc-print-choice { display: flex; align-items: center; gap: 6px; width: fit-content; margin: 6px 0; font-size: .8rem; }
  .dc-print-choice input { accent-color: #25493f; margin: 0; width: 16px; height: 16px; }
  .dc-ability > .dc-print-choice { float: inline-end; margin: 0 0 4px 8px; }
  :is(.datacard, .dc-ability):has(> .dc-print-choice input:not(:checked)) { border-style: dashed; }
  @page { margin: 11mm; }
  @media print {
    :root, .dc-cards .datacard, .dc-stats > div, .dc-metrics > div { background: white; }
    body { max-width: none; padding: 0; font-size: 10pt; }
    button, .dc-print-choice, .dc-print-hint, :is(.datacard, .dc-ability):has(> .dc-print-choice input:not(:checked)) { display: none; }
    .masthead { break-inside: avoid; margin-bottom: 4mm; padding-bottom: 3mm; }
    .masthead h1 { font-size: 22pt; }
    .dc-cards { display: block; column-count: 2; column-gap: 4mm; }
    .dc-cards .datacard { break-inside: avoid; margin: 0 0 4mm; padding: 3mm; }
    .dc-ability { break-inside: avoid; }
    .dc-title h2 { font-size: 15pt; }
  }
</style></head>
<body>
<header class="masthead"><div><p class="dc-label">Path to Glory · Campaign datacards</p><h1>${escape(warband.name)}</h1>
<p class="warband-facts">${[campaign.name, warband.faction, warband.warlord ? `Warlord ${warband.warlord}` : '', `${fmt(Ledger.points(warband))} roster points`, warband.archived ? 'Archived' : ''].filter(Boolean).map(escape).join(' · ')}</p></div>
<button type="button" onclick="window.print()">Print or save PDF</button></header>
<main aria-label="Unit datacards"><p class="dc-print-hint">Uncheck a card or ability to omit it from the printout.</p>${warbandCardList(warband, battles, { printControls: true })}</main></body></html>`;
}

function exportDatacards() {
  const warband = activeArmy();
  if (!warband?.units.length) return;
  const slug = warband.name.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').slice(0, 72).replace(/^-|-$/g, '') || 'warband';
  downloadFile(`${slug}-datacards.html`, warbandDatacards(state.campaign, warband, state.battles), 'text/html;charset=utf-8');
  tell('Warband datacards downloaded.');
}

function removeRecord(records, record, title, description, beforeRemove) {
  confirmDialog(title, description, 'Delete record', () => {
    if (beforeRemove) beforeRemove();
    records.splice(records.indexOf(record), 1);
    return ['Record deleted.'];
  });
}

function selectWarband(id, page) {
  if (!army(id)) return;
  state.activeArmyId = id;
  save();
  if (page && page !== currentPage()) location.hash = page;
  else render();
}

const actions = {
  start: startCampaign,
  export: exportBackup,
  'export-datacards': exportDatacards,
  'view-datacards': () => viewWarbandDatacards(activeArmy()),
  'view-unit-datacard': id => {
    const warband = activeArmy();
    const unit = warband?.units.find(item => item.id === id);
    if (unit) viewWarbandDatacards(warband, unit);
  },
  'profile-library': () => viewProfileLibrary(true),
  'back-to-profile-library': () => viewProfileLibrary(),
  'view-catalogue-datacard': viewCatalogueDatacard,
  import: () => importFile.click(),
  print: () => {
    if (currentPage() === 'overview') window.print();
    else {
      window.addEventListener('hashchange', () => window.print(), { once: true });
      location.hash = 'overview';
    }
  },
  close: () => dialog.close(),
  'new-warband': () => warbandForm(),
  'edit-warband': () => warbandForm(activeArmy()),
  'archive-warband': () => {
    const a = activeArmy();
    a.archived = !a.archived;
    if (a.archived) state.activeArmyId = state.armies.find(other => !other.archived)?.id || a.id;
    commit(a.archived ? 'Warband archived.' : 'Warband restored.');
  },
  'select-warband': id => selectWarband(id),
  'go-warband': id => selectWarband(id, 'warbands'),
  'quest-warband': id => selectWarband(id, 'quests'),
  'new-unit': () => unitForm(activeArmy()),
  'edit-unit': id => unitForm(activeArmy(), activeArmy().units.find(u => u.id === id)),
  'unit-history': id => unitHistory(activeArmy(), activeArmy().units.find(u => u.id === id)),
  'remove-unit': id => {
    const a = activeArmy();
    const u = a.units.find(unit => unit.id === id);
    removeRecord(a.units, u, `Remove ${u.name}?`, 'The unit will be removed from the roster. Its Renown awards will remain in the battle history.', () => {
      for (const battle of state.battles) {
        for (const award of battle.awards) if (award.armyId === a.id && award.unitId === id) award.unitName = u.name;
      }
    });
  },
  'new-resource': () => resourceForm(activeArmy()),
  'edit-resource': id => resourceForm(activeArmy(), activeArmy().ledger.find(item => item.id === id)),
  'remove-resource': id => {
    const list = activeArmy().ledger;
    removeRecord(list, list.find(item => item.id === id), 'Delete adjustment?', 'The warband’s balance will be recalculated.');
  },
  'new-battle': () => battleForm(),
  'edit-battle': id => battleForm(state.battles.find(b => b.id === id)),
  'view-battle': id => viewBattle(state.battles.find(b => b.id === id)),
  'remove-battle': id => removeRecord(state.battles, state.battles.find(b => b.id === id), 'Delete battle?', 'This removes the result and its linked resource changes and Renown awards.'),
  'new-quest': () => questForm(activeArmy()),
  'edit-quest': id => questForm(activeArmy(), activeArmy().quests.find(q => q.id === id)),
  'complete-quest': id => {
    const q = activeArmy().quests.find(item => item.id === id);
    q.status = 'Completed';
    if (q.target) q.progress = q.target;
    commit('Quest completed.');
  },
  'remove-quest': id => {
    const list = activeArmy().quests;
    removeRecord(list, list.find(q => q.id === id), 'Delete quest?', 'This removes the quest, its progress, and reward notes.');
  },
  'new-entry': () => entryForm(),
  'edit-entry': id => entryForm(state.entries.find(e => e.id === id)),
  'remove-entry': id => removeRecord(state.entries, state.entries.find(e => e.id === id), 'Delete chronicle entry?', 'This removes this entry from the campaign chronicle.'),
};

document.addEventListener('click', event => {
  const trigger = event.target.closest('[data-action]');
  if (trigger) actions[trigger.dataset.action]?.(trigger.dataset.id);
  if (event.target === dialog) {
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  }
  if (event.target.closest('.skip-link')) {
    event.preventDefault();
    main.focus();
    main.scrollIntoView();
  }
});

document.addEventListener('submit', event => {
  const form = event.target;
  if (form.id !== 'editor-form' && form.id !== 'settings-form') return;
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  try {
    if (form.id === 'settings-form') {
      state.campaign = campaignValues(values);
      commit('Campaign details saved.');
    } else if (editor) {
      const [message, page] = editor(values, form);
      dialog.close();
      commit(message, page);
    }
  } catch (error) {
    const message = form.querySelector('.form-error');
    if (!message) tell(error.message, true);
    else {
      message.hidden = false;
      message.textContent = error.message;
      message.scrollIntoView({ block: 'nearest' });
    }
  }
});

function updateFilters(event) {
  const input = event.target;
  if (!input.closest('#battle-filters')) return;
  filters[input.name] = input.value;
  document.querySelector('#battle-results').innerHTML = battleResults();
}

main.addEventListener('input', event => {
  if (event.target.name === 'query') updateFilters(event);
});

document.addEventListener('change', event => {
  const input = event.target;
  if (input.closest('#battle-filters') && input.name !== 'query') updateFilters(event);
  if (input.name === 'quest-warband') selectWarband(input.value);
  if (input.name === 'pack' && input.form) {
    const resource = input.form.elements.resource;
    if (!resource.value.trim() || [...Ledger.packs.values()].includes(resource.value)) resource.value = Ledger.packs.get(input.value) || Ledger.packs.get('Custom');
  }
});

dialog.addEventListener('close', () => {
  if (dialog.open) return;
  editor = null;
  if (lastFocus?.isConnected) lastFocus.focus();
  else main.focus();
});

importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  importFile.value = '';
  if (!file) return;
  try {
    const incoming = Ledger.normalize(JSON.parse(await file.text()));
    confirmDialog(`Import ${incoming.campaign.name}?`, `This backup has ${incoming.armies.length} warbands and ${incoming.battles.length} battles. Importing replaces the current campaign in this browser.`, 'Import campaign', () => {
      state = incoming;
      filters = { query: '', army: '', result: '' };
      return ['Campaign imported.', 'overview'];
    });
  } catch (error) {
    tell(`Backup could not be imported. ${error.message}`, true);
  }
});

window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
});

window.addEventListener('storage', event => {
  if (event.key !== storageKey && event.key !== null) return;
  if (dialog.open || !storageOK || document.activeElement?.closest('#settings-form')) {
    storageConflict = true;
    tell('This campaign changed in another tab. Export any unsaved work before reloading.', true);
    return;
  }
  try {
    const next = event.newValue === null ? Ledger.sample() : Ledger.normalize(JSON.parse(event.newValue));
    state = next;
    savedValue = event.newValue;
    filters = { query: '', army: '', result: '' };
    render();
  } catch {
    storageConflict = true;
    tell('The campaign in another tab could not be loaded.', true);
  }
});

document.querySelector('#brand-mark').innerHTML = icon('shield');
if (loadedLegacy) save();
render();
