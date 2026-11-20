'use strict';

const icons = {
  overview: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  shield: '<path d="M12 22s7-3 8-10V5l-8-3-8 3v7c1 7 8 10 8 10Z"/><path d="m12 7 1.3 3.4 3.7 1.6-3.7 1.5L12 17l-1.3-3.5L7 12l3.7-1.6L12 7Z"/>',
  swords: '<path d="m14.5 17.5 3 3 3-3-3-3M13 19l6-6M3 3l4 .5L15 12l-3 3-8.5-8L3 3ZM9.5 17.5l-3 3-3-3 3-3M11 19l-6-6M14 8l3-4.5 4-.5-.5 4L17 10"/>',
  battle: '<path d="m7 9 13 12M9 7l12 13M3 3c1 2 3 2 5 1l2 2-4 4C3 9 2 6 3 3Zm13 0 5 5-3 3-5-5 3-3ZM15 9 4 20l1 1L16 10"/>',
  spell: '<path d="M12 11v10m0-8c-3-2-6-3-9-2v8c3-1 6 0 9 2 3-2 6-3 9-2v-8c-3-1-6 0-9 2Zm0-11 1.2 3.8L17 7l-3.8 1.2L12 12l-1.2-3.8L7 7l3.8-1.2L12 2Z"/>',
  prayer: '<path d="M8 21h8m-4-4v4m-5-5h10M12 3c1 4 5 6 4 9-.4 2-2 3-4 3s-4-1-4-4c0-1.5.8-3 2-4 0 2 1 2 1 2 1.5-2 1.5-4 1-6ZM4 9H2m20 0h-2M6 5 4 3m14 2 2-2"/>',
  manifestation: '<ellipse cx="12" cy="19" rx="8" ry="2.5"/><path d="M12 18c3-5-7-4-5-10 1.4-5.5 9-5.5 10 .2.4 2-1 4-2.5 5 .6-2-.4-2.5-1.3-2.4-3 .2.4 4-1.2 7.2ZM10 8h.1m4-.5h.1"/>',
  hero: '<path d="m3 7 4.5 5L12 5l4.5 7L21 7l-2 12H5L3 7Zm3 9h12"/>',
  infantry: '<path d="M11 21H5v-7l3-2 3 2v7Zm-3-6v3m5-6 6-8 2-1v4l-6 8m-3-4 5 4m-4-2-3 4"/>',
  cavalry: '<path d="M6 20h13v-4c0-6-3-10-8-12v4L5 11l-2 4 4 2 4-3v3l-5 3Zm7-9h.1M6 22h13"/>',
  cannon: '<path d="m4 11 15-6 2 4-15 6-2-4Zm9 2 6 6h2"/><circle cx="8" cy="18" r="3"/>',
  monster: '<path d="M4 19c-1-6 2-10 6-14l1 2C7 11 7 14 4 19Zm7 1c-1-6 2-12 6-16l1 2c-4 5-4 9-7 14Zm7-1c-.5-4 1-8 4-11l1 2c-2 3-3 6-5 9Z"/>',
  terrain: '<path d="M3 21h18M5 21V7h3v3h3V5h3v5h3V7h2v14m-9 0v-5h4v5"/>',
  other: '<path d="m12 3 9 5v8l-9 5-9-5V8l9-5Zm-9 5 9 5 9-5m-9 5v8"/>',
  edit: '<path d="m4 16-1 5 5-1L21 7l-4-4ZM14 6l4 4"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  print: '<path d="M7 8V3h10v5M7 17H3V8h18v9h-4M7 14h10v7H7Zm10-3h1"/>',
  flag: '<path d="M4 22V3m0 2c6-5 10 4 16 0v11c-6 4-10-5-16 0"/>',
  book: '<path d="M4 19V5a2 2 0 0 1 2-2h14v18H6a2 2 0 0 1 0-4h14M8 7h8m-8 4h6"/>',
  settings: '<path d="M4 6h16M4 12h16M4 18h16M8 4v4m8 2v4m-6 2v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  star: '<path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2Z"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="m12 7 3 5-3 5-3-5 3-5Z"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};

const icon = name => Object.hasOwn(icons, name) ? `<svg class="icon" data-icon="${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>` : '';
const unitIcons = { Hero: 'hero', Infantry: 'infantry', Cavalry: 'cavalry', 'War Machine': 'cannon', Monster: 'monster', Terrain: 'terrain', Other: 'other', Manifestation: 'manifestation' };
const unitIcon = type => icon(unitIcons[Ledger.unitType(type)]);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const fmt = number => number.toLocaleString();
const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const dateText = date => date ? dateFmt.format(new Date(`${date}T12:00:00`)) : 'Undated';
const makeDate = date => `<time datetime="${escape(date)}">${dateText(date)}</time>`;

const actionIcons = { 'view-datacards': 'book', 'view-unit-datacard': 'book', 'unit-history': 'swords', 'complete-quest': 'check', 'forfeit-quest': 'flag', 'new-resource': 'coin', import: 'download', print: 'print' };
const button = (label, action, { type = 'secondary', glyph = actionIcons[action] ?? (action.startsWith('edit-') ? 'edit' : undefined), id, title, disabled = false } = {}) =>
  `<button class="button ${type}" type="button" data-action="${action}"${id ? ` data-id="${escape(id)}"` : ''}${title ? ` aria-label="${escape(title)}"` : ''}${disabled ? ' disabled' : ''}>${glyph ? icon(glyph) : ''}${escape(label)}</button>`;
function accountControls() {
  if (!Account.configured) return '<span class="account-status quiet">Cloud setup pending</span>';
  if (!Account.ready) return '<span class="account-status quiet">Checking account…</span>';
  if (Account.error) return `<span class="account-status negative">${escape(Account.error)}</span>`;
  const user = Account.user;
  if (!user) return button('Continue with Google', 'sign-in', { type: 'primary' });
  const label = user.user_metadata?.full_name || user.email || 'Google account';
  const sync = CampaignCloud.error || CampaignCloud.label;
  const problem = ['error', 'conflict'].includes(CampaignCloud.state);
  return `<span class="account-status" title="${escape(user.email)}">${escape(label)}</span><span class="sync-status${problem ? ' negative' : ''}" title="${escape(sync)}">${escape(CampaignCloud.label)}</span>${CampaignCloud.state === 'conflict' ? button('Resolve', 'resolve-conflict') : ''}${button('Sign out', 'sign-out')}`;
}
const pageLink = (label, page, glyph) => `<a class="button link" href="#${page}">${icon(glyph)}${escape(label)}</a>`;
const badge = (label, style = label.toLowerCase()) => `<span class="pill ${style}">${escape(label)}</span>`;
const add = (label, action) => button(label, action, { type: 'primary', glyph: 'plus' });
const tile = (glyph, color) => `<span class="tile${color ? ' warband' : ''}"${color ? ` style="--warband:${Ledger.validColor(color)}"` : ''}>${icon(glyph)}</span>`;
const empty = (title, copy, action = '') => `<div class="empty"><p><strong>${escape(title)}</strong></p>${copy ? `<p class="meta">${escape(copy)}</p>` : ''}${action ? `<div class="actions">${action}</div>` : ''}</div>`;
const section = (title, body, actions = '', glyph) => `<section class="panel"><div class="panel-head"><h2>${icon(glyph)}${escape(title)}</h2>${actions}</div>${body}</section>`;
const heading = (title, subtitle, actions = '') => `<div class="page-head"><div><h1>${escape(title)}</h1>${subtitle ? `<p class="meta">${escape(subtitle)}</p>` : ''}</div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
const span = (label, value) => value ? `<p class="meta copy"><span class="detail-label">${escape(label)}</span> · ${escape(value)}</p>` : '';
const signed = value => `<span class="${value >= 0 ? 'positive' : 'negative'}">${Ledger.signed(value)}</span>`;

function field(label, key, value = '', { type = 'text', placeholder = '', required = false, min, full = false } = {}) {
  return `<div class="field${full ? ' full' : ''}"><label for="field-${key}">${escape(label)}</label><input id="field-${key}" name="${key}" value="${escape(value)}" type="${type}"${required ? ' required' : ''}${min !== undefined ? ` min="${min}"` : ''}${type === 'number' ? ' step="1"' : ''}${type === 'text' ? ' maxlength="160"' : ''}${placeholder ? ` placeholder="${escape(placeholder)}"` : ''}></div>`;
}

function optionTitle(value) {
  return String(value ?? '').toLocaleLowerCase().replace(/(^|[\s\-–—/(])([\p{L}])/gu, (_, prefix, letter) => prefix + letter.toLocaleUpperCase());
}

function select(label, key, options, value) {
  const items = options.map(option => {
    const [id, name, disabled] = Array.isArray(option) ? option : [option, option];
    return `<option value="${escape(id)}"${id === value ? ' selected' : ''}${disabled ? ' disabled' : ''}>${escape(optionTitle(name))}</option>`;
  }).join('');
  return `<div class="field"><label for="field-${key}">${escape(label)}</label><select id="field-${key}" name="${key}">${items}</select></div>`;
}

function area(label, key, value, rows = 3, required = false) {
  return `<div class="field full"><label for="field-${key}">${escape(label)}</label><textarea id="field-${key}" name="${key}" rows="${rows}"${required ? ' required' : ''}>${escape(value)}</textarea></div>`;
}

const modelCount = size => `${fmt(size)} ${size === 1 ? 'model' : 'models'}`;

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
