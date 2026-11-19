'use strict';

function overview() {
  const c = CampaignStore.data.campaign;
  const active = CampaignStore.data.armies.filter(item => !item.archived);
  const a = active.find(item => item.id === CampaignStore.data.activeArmyId) || active[0];
  const activeQuests = active.flatMap(item => item.quests.filter(q => q.status === 'Active').map(q => ({ item, q })));
  const completed = active.reduce((sum, item) => sum + item.quests.filter(q => q.status === 'Completed').length, 0);
  const latest = sortedBattles().slice(0, 4);
  const cards = [
    ['shield', 'Warbands', active.length, `${active.reduce((sum, item) => sum + item.units.filter(u => u.status !== 'Retired').length, 0)} rostered units`],
    ['swords', 'Battles played', CampaignStore.data.battles.length, a ? `${Ledger.record(CampaignStore.data, a.id).Victory} wins for ${a.name}` : 'Campaign history'],
    ['coin', c.resource, a ? Ledger.balance(CampaignStore.data, a) : 0, a ? a.name : 'Warband balance'],
    ['flag', 'Active quests', activeQuests.length, `${completed} completed`],
  ];
  const stats = cards.map(([glyph, title, number, caption]) => `<div class="stat"><div class="stat-head">${icon(glyph)}${escape(title)}</div><strong class="stat-value">${fmt(number)}</strong><p class="meta">${escape(caption)}</p></div>`).join('');
  const recent = latest.length ? latest.map(b => battleRow(b)).join('') : empty('No battles recorded', 'Log the first result and its aftermath.', a ? add('Record battle', 'new-battle') : '');
  const quests = activeQuests.length ? activeQuests.slice(0, 4).map(({ item, q }) => `<div class="list-item"><button type="button" class="list-button row" data-action="quest-warband" data-id="${escape(item.id)}">${tile('flag')}<span class="row-main"><strong class="row-title">${escape(q.title)}</strong><span class="meta row-sub">${escape(item.name)}</span></span></button>${questProgress(q)}</div>`).join('') : empty('No active quests', 'Give a warband a campaign objective.');
  const start = !a ? add('Create warband', 'new-warband') : add('Record battle', 'new-battle');
  return `<section class="hero"><div class="hero-content"><div class="hero-kicker">${escape(c.pack)}${CampaignStore.data.sample ? badge('Sample campaign', 'sample') : ''}</div><h1>${escape(c.name)}</h1>${c.location ? `<p class="meta">${escape(c.location)}</p>` : ''}<div class="actions">${start}${CampaignStore.data.sample ? button('Start my campaign', 'start') : ''}</div></div></section>
    <div class="stats">${stats}</div>
    <div class="layout overview-layout"><div class="stack">${section('Recent battles', recent, pageLink('All battles', 'battles'))}${section('Warbands', active.length ? active.map(item => warbandRow(item, 'go-warband')).join('') : empty('No active warbands', 'Create or restore a warband.'), pageLink('View warbands', 'warbands'))}</div>
    <div class="stack">${section('Active quests', quests, pageLink('All quests', 'quests'))}${c.notes ? section('Campaign notes', `<p class="copy muted">${escape(c.notes)}</p>`) : ''}</div></div>`;
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
  const entries = [...CampaignStore.data.entries].sort(Ledger.dateOrder);
  return heading('Chronicle', 'The story of your campaign.', add('Write entry', 'new-entry')) + section('Campaign entries',
    entries.length ? entries.map(entry => `<article class="book-entry"><div class="split"><div><h3>${escape(entry.title)}</h3><p class="meta row-sub">${makeDate(entry.date)} · ${escape(army(entry.armyId)?.name || 'Campaign-wide')}</p></div>${button('Edit', 'edit-entry', { id: entry.id })}</div><p class="copy">${escape(entry.body)}</p></article>`).join('') : empty('No chronicle entries yet', 'Record a turning point, a rivalry, or a deed worth remembering.'));
}

function settings() {
  const c = CampaignStore.data.campaign;
  return heading('Settings', 'Campaign details and backups.') + `<div class="stack setting-panels">
    ${section('Campaign details', `<form id="settings-form" class="form-grid">${campaignFields(c)}<div class="actions full"><button type="submit" class="button primary">Save campaign details</button></div></form>`)}
    ${section('Your data', `<p class="copy muted">Campaign records are stored in this browser. Export a JSON backup to keep a copy or move the campaign to another browser.</p><div class="actions" style="margin-top:13px">${button('Export backup', 'export', { glyph: 'download' })}${button('Import backup', 'import')}${button('Print overview', 'print')}</div>`)}
    ${section('Start over', `<p class="copy muted">Starting a new campaign replaces the current record in this browser.</p><div class="actions" style="margin-top:13px">${button('Start new campaign', 'start', { type: 'danger' })}</div>`)}</div>`;
}

function campaignFields(c) {
  const packs = [...Ledger.packs.keys()];
  if (!packs.includes(c.pack)) packs.push(c.pack);
  return field('Campaign name', 'name', c.name, { required: true }) + select('Battlepack', 'pack', packs, c.pack) + field('Region', 'location', c.location) +
    field('Resource name', 'resource', c.resource) + field('Roster points reference', 'pointsLimit', c.pointsLimit, { type: 'number', min: 1, required: true }) + area('Campaign notes and house rules', 'notes', c.notes, 4);
}

function campaignValues(v) {
  return { name: required(v.name, 'Campaign name'), pack: v.pack, location: v.location.trim(), resource: v.resource.trim() || Ledger.packs.get(v.pack) || Ledger.packs.get('Custom'), pointsLimit: whole(v.pointsLimit, 'Roster points reference', 1), notes: v.notes.trim() };
}

function startCampaign() {
  formDialog('Start a new campaign', campaignFields({ ...Ledger.blank().campaign, name: '' }), v => {
    CampaignStore.data = { ...Ledger.blank(), campaign: campaignValues(v) };
    resetBattleFilters();
    return ['Campaign created.', 'overview'];
  }, { label: 'Start campaign', description: CampaignStore.data.sample && savedValue === null ? 'Set up your campaign after exploring the sample.' : 'This replaces the current campaign in this browser. Export a backup first to keep a copy.' });
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
    else CampaignStore.data.entries.push({ id: Ledger.id(), ...values });
    return ['Chronicle entry saved.', 'chronicle'];
  }, { label: 'Save entry', remove: existing ? button('Delete entry', 'remove-entry', { id: j.id, type: 'danger' }) : '' });
}
