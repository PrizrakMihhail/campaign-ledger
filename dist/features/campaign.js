'use strict';

function overview() {
  const c = CampaignStore.data.campaign;
  const a = viewedArmy();
  const activeQuests = a?.quests.filter(q => q.status === 'Active') ?? [];
  const completed = a?.quests.filter(q => q.status === 'Completed').length ?? 0;
  const recentBattles = warbandBattles(a);
  const rostered = a?.units.filter(unit => Ledger.rosterStatus(unit, a.id, CampaignStore.data.battles) !== 'Retired').length ?? 0;
  const cards = [
    ['shield', 'Rostered units', rostered, a?.name ?? 'No warband selected'],
    ['swords', 'Battles played', recentBattles.length, a ? `${Ledger.record(CampaignStore.data, a.id).Victory} wins for ${a.name}` : 'Battle history'],
    ['coin', Ledger.gloryPoints, a ? Ledger.balance(CampaignStore.data, a) : 0, a ? a.name : 'Warband balance'],
    ['flag', 'Active quests', activeQuests.length, `${completed} completed`],
  ];
  const stats = cards.map(([glyph, title, number, caption]) => `<div class="stat"><div class="stat-head">${icon(glyph)}${escape(title)}</div><strong class="stat-value">${fmt(number)}</strong><p class="meta">${escape(caption)}</p></div>`).join('');
  const canBattle = a && !a.archived;
  const recent = recentBattles.length ? recentBattles.slice(0, 4).map(b => battleRow(b, a.id)).join('')
    : empty('No battles recorded', canBattle ? 'Log the first result and its aftermath.' : '');
  const quests = activeQuests.length ? activeQuests.map(q => `<div class="list-item"><a href="#quests" class="list-button row">${tile('flag')}<strong class="row-title">${escape(q.title)}</strong></a>${questProgress(a, q)}</div>`).join('') : empty('No active quests', '');
  const start = !a ? add('Create warband', 'new-warband') : canBattle ? add('Record battle', 'new-battle') : '';
  return `<section class="hero"><div class="hero-content"><div class="hero-kicker">${escape(c.pack)}</div><h1>${escape(c.name)}</h1>${c.location ? `<p class="meta">${escape(c.location)}</p>` : ''}<div class="actions">${start}${pageLink('Campaign selection', 'campaigns')}</div></div></section>
    <div class="stats">${stats}</div>
    <div class="layout overview-layout"><div class="stack">${section('Recent battles', recent, pageLink('View battles', 'battles'))}${section('Warband', a ? warbandRow(a) : empty('No warband selected', 'Select or create a warband.'), pageLink('View warband', 'warbands'))}</div>
    <div class="stack">${section('Active quests', quests, pageLink('All quests', 'quests'))}${c.notes ? section('Campaign notes', `<p class="copy muted">${escape(c.notes)}</p>`) : ''}</div></div>`;
}

function questProgress(a, q) {
  const points = (q.progress ?? 0) + Ledger.questBattlePoints(CampaignStore.data.battles, a.id, q.id);
  if (!q.target) return `<p class="meta">Quest Points · <strong>${fmt(points)}</strong></p>`;
  return `<div class="progress-caption meta"><span>Quest Points</span><strong>${fmt(points)} / ${fmt(q.target)}</strong></div><progress class="progress" max="${q.target}" value="${Math.min(points, q.target)}" aria-label="${escape(q.title)} progress"></progress>`;
}

function quests() {
  const a = viewedArmy();
  const active = Ledger.activeQuest(a);
  const title = heading('Quests', a?.name, a ? button('Add quest', 'new-quest', { type: 'primary', glyph: 'plus', disabled: Boolean(active) }) : '');
  if (!a) return title + empty('No warband selected', 'Select or create a warband to track its quests.', pageLink('View warbands', 'warbands'));
  const groups = Ledger.questStatuses.map(status => {
    const items = a.quests.filter(q => q.status === status);
    if (!items.length && status !== 'Active') return '';
    return section(`${status} quests`, items.length ? `<div class="cards">${items.map(q => `<article class="card"><div class="split"><h3>${escape(q.title)}</h3>${badge(q.status)}</div>${q.goal ? `<p class="copy muted">${escape(q.goal)}</p>` : ''}${questProgress(a, q)}${span('Reward', q.reward)}${q.notes ? `<p class="meta copy">${escape(q.notes)}</p>` : ''}<div class="actions">${button('Edit quest', 'edit-quest', { id: q.id })}${q.status === 'Active' ? button('Mark complete', 'complete-quest', { id: q.id, type: 'link' }) + button('Forfeit', 'forfeit-quest', { id: q.id, type: 'danger' }) : ''}</div></article>`).join('')}</div>` : empty('No active quests', 'Add an objective for this warband.'));
  }).join('');
  return title + `<div class="stack">${groups}</div>`;
}

function chronicle() {
  const a = viewedArmy();
  const entries = CampaignStore.data.entries.filter(entry => !entry.armyId || entry.armyId === a?.id).sort(Ledger.dateOrder);
  return heading('Chronicle', a?.name || 'Campaign-wide entries', add('Write entry', 'new-entry')) + section('Chronicle entries',
    entries.length ? entries.map(entry => `<article class="book-entry"><div class="split"><div><h3>${escape(entry.title)}</h3><p class="meta row-sub">${makeDate(entry.date)} · ${escape(army(entry.armyId)?.name || 'Campaign-wide')}</p></div>${button('Edit', 'edit-entry', { id: entry.id })}</div><p class="copy">${escape(entry.body)}</p></article>`).join('') : empty('No chronicle entries yet', 'Record a turning point, a rivalry, or a deed worth remembering.'));
}

function settings() {
  const c = CampaignStore.data.campaign;
  return heading('Settings', 'Campaign details and backups.') + `<div class="stack setting-panels">
    ${section('Campaign details', `<form id="settings-form" class="form-grid">${campaignFields(c)}<div class="actions full"><button type="submit" class="button primary">Save campaign details</button></div></form>`)}
    ${section('Your data', `<p class="copy muted">Campaign records are stored in this browser. Export a JSON backup to keep a copy or move the campaign to another browser.</p><div class="actions" style="margin-top:13px">${button('Export backup', 'export', { glyph: 'download' })}${button('Import backup', 'import')}${button('Print overview', 'print')}</div>`)}</div>`;
}

function campaignFields(c) {
  const packs = [...Ledger.packs.keys()];
  if (!packs.includes(c.pack)) packs.push(c.pack);
  return field('Campaign name', 'name', c.name, { required: true }) + select('Battlepack', 'pack', packs, c.pack) + field('Region', 'location', c.location) +
    field('Campaign Resource', 'resource', c.resource, { placeholder: 'Optional' }) + field('Roster points reference', 'pointsLimit', c.pointsLimit, { type: 'number', min: 1, required: true }) + area('Campaign notes and house rules', 'notes', c.notes, 4);
}

function campaignValues(v) {
  return { name: required(v.name, 'Campaign name'), pack: v.pack, location: v.location.trim(), resource: Ledger.resourceName(v.resource), pointsLimit: whole(v.pointsLimit, 'Roster points reference', 1), notes: v.notes.trim() };
}

const newCampaignDefaults = () => ({ ...Ledger.blank().campaign, name: '' });

function campaignSelection() {
  const cards = CampaignStore.campaigns.map(({ id, data: { campaign, armies, battles } }) => `<article class="card campaign-option">
    <div><p class="label">${escape(campaign.pack)}</p><h2>${escape(campaign.name)}</h2>
      <p class="meta">${campaign.location ? `${escape(campaign.location)} · ` : ''}${fmt(armies.length)} ${armies.length === 1 ? 'warband' : 'warbands'} · ${fmt(battles.length)} ${battles.length === 1 ? 'battle' : 'battles'}</p></div>
    ${button('Open campaign', 'open-campaign', { id, glyph: 'overview' })}</article>`).join('');
  return `<div class="campaign-selection stack">
    <header class="campaign-banner"><img src="assets/fortress.jpg" alt=""><div class="campaign-banner-title">
      <p class="hero-kicker">Path to Glory</p><h1>Campaigns</h1></div></header>
    <div class="campaign-toolbar"><div class="actions">${button('Create campaign', 'start', { type: 'primary', glyph: 'plus' })}${button('Import backup', 'import')}</div><div class="account-controls">${accountControls()}</div></div>
    ${cards ? `<div class="campaign-options">${cards}</div>` : empty('No campaigns yet', 'Create a campaign or import a backup.')}
  </div>`;
}

function createCampaign(values) {
  CampaignStore.add({ ...Ledger.blank(), campaign: campaignValues(values) });
  resetCampaignView();
  return ['Campaign created.', 'overview'];
}

function startCampaign() {
  formDialog('Start a new campaign', campaignFields(newCampaignDefaults()), createCampaign,
    { label: 'Create campaign' });
}

function questForm(a, existing) {
  const otherActive = Ledger.activeQuest(a);
  if (!existing && otherActive) return;
  const q = existing || {};
  const statuses = Ledger.questStatuses.filter(status => status !== 'Active' || !otherActive || otherActive === existing);
  const battlePoints = existing ? Ledger.questBattlePoints(CampaignStore.data.battles, a.id, q.id) : 0;
  formDialog(existing ? 'Edit quest' : `Add quest for ${a.name}`, field('Quest name', 'title', q.title, { required: true }) + select('Status', 'status', statuses, q.status || 'Active') +
    area('Objective', 'goal', q.goal) + field('Quest Points target (optional)', 'target', q.target || '', { type: 'number', min: 1 }) + field('Manual Quest Points', 'progress', q.progress ?? 0, { type: 'number', min: 0 }) +
    area('Reward', 'reward', q.reward) + area('Notes', 'notes', q.notes), v => {
    const values = { ...v, title: required(v.title, 'Quest name'), target: whole(v.target, 'Target', 0), progress: whole(v.progress, 'Progress', 0) };
    if (values.status === 'Active' && a.quests.some(quest => quest !== existing && quest.status === 'Active')) throw new Error('Complete or forfeit the active quest first.');
    if (values.status === 'Completed' && values.target) values.progress = Math.max(values.progress, values.target - battlePoints);
    if (existing) Object.assign(existing, values);
    else a.quests.push({ id: Ledger.id(), ...values });
    return ['Quest saved.', 'quests'];
  }, { label: 'Save quest', description: battlePoints ? `${fmt(battlePoints)} Quest Points from recorded battles are added to the manual total.` : '', remove: existing ? button('Delete quest', 'remove-quest', { id: q.id, type: 'danger' }) : '' });
}

function entryForm(existing) {
  const j = existing || {};
  formDialog(existing ? 'Edit chronicle entry' : 'Write a chronicle entry',
    field('Title', 'title', j.title, { full: true, required: true }) + field('Date', 'date', j.date || Ledger.date(), { type: 'date', required: true }) +
    select('Warband', 'armyId', [['', 'Campaign-wide'], ...armyOptions()], j.armyId ?? viewedArmy()?.id ?? '') + area('Entry', 'body', j.body, 7, true), v => {
    const values = { ...v, title: required(v.title, 'Title'), body: required(v.body, 'Entry') };
    if (existing) Object.assign(existing, values);
    else CampaignStore.data.entries.push({ id: Ledger.id(), ...values });
    return ['Chronicle entry saved.', 'chronicle'];
  }, { label: 'Save entry', remove: existing ? button('Delete entry', 'remove-entry', { id: j.id, type: 'danger' }) : '' });
}
