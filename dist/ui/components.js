'use strict';

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
