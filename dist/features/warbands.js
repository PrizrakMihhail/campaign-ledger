'use strict';

function warbandRow(a, action, selected = false) {
  return `<div class="list-item"><button class="list-button row" type="button" data-action="${action}" data-id="${escape(a.id)}"${selected ? ' aria-current="true"' : ''}>${tile('shield', a.color)}<span class="row-main"><strong class="row-title">${escape(a.name)}</strong><span class="meta row-sub">${escape([a.faction, `${fmt(Ledger.points(a))} pts`].filter(Boolean).join(' · '))}</span></span>${a.archived ? badge('Archived', 'retired') : ''}</button></div>`;
}

function warbands() {
  const title = heading('Warbands', 'Order of battle, unit progression, and resource ledgers.', button('Profile library', 'profile-library', { glyph: 'book' }) + add('New warband', 'new-warband'));
  const a = activeArmy();
  if (!a) return title + empty('No warbands yet', 'Create a warband to start tracking a roster and its progress.');
  const rec = Ledger.record(CampaignStore.data, a.id);
  const warlord = Ledger.warlord(a);
  const points = Ledger.points(a);
  const lorePoints = Ledger.lorePoints(a);
  const cap = CampaignStore.data.campaign.pointsLimit;
  const selector = section('Campaign warbands', CampaignStore.data.armies.map(item => warbandRow(item, 'select-warband', item.id === a.id)).join(''));
  const summary = `<section class="panel stack"><div class="split">${tile('shield', a.color)}<div class="row-main"><h2>${escape(a.name)}</h2><p class="meta">${escape(a.faction)}</p></div>${a.archived ? badge('Archived', 'retired') : ''}</div>
    <div class="facts meta"><span><strong class="${points > cap ? 'negative' : ''}">${fmt(points)} / ${fmt(cap)}</strong> roster pts</span><span><strong>${rec.Victory}–${rec.Defeat}–${rec.Draw}</strong> W–L–D</span>${warlord ? `<span>Warlord · <strong>${escape(Ledger.unitName(warlord))}</strong></span>` : ''}</div>
    <progress class="progress" max="${cap}" value="${Math.min(points, cap)}" aria-label="Roster points reference"></progress>
    ${span('Battle Formation', a.formation)}
    ${lorePoints ? `<p class="meta">Includes ${fmt(lorePoints)} battle pts from Arcane Tome.</p>` : ''}
    ${a.notes ? `<p class="copy muted">${escape(a.notes)}</p>` : ''}<div class="actions">${button('Edit warband', 'edit-warband')}${button(a.archived ? 'Restore warband' : 'Archive warband', 'archive-warband', { type: 'link' })}</div></section>`;
  const sorted = Ledger.sortedUnits(a.units, warlord?.id);
  const unitCards = (units, emptyTitle) => units.length ? `<div class="cards">${units.map(unit => unitCard(a, unit)).join('')}</div>` : empty(emptyTitle, '');
  const transactions = Ledger.transactions(CampaignStore.data, a);
  const history = transactions.length ? `<div class="table-scroll"><table><thead><tr><th>Date</th><th>Reason</th><th>Change</th><th>Action</th></tr></thead><tbody>${transactions.map(t => `<tr><td class="nowrap">${makeDate(t.date)}</td><td>${escape(t.reason)}</td><td>${signed(t.delta)}</td><td>${t.manual ? button('Edit', 'edit-resource', { id: t.id }) : button('View battle', 'view-battle', { id: t.id, type: 'link' })}</td></tr>`).join('')}</tbody></table></div>` : empty('No resource changes', 'Battle rewards and manual adjustments appear here.');
  const datacardActions = hasWarbandDatacards(a) ? button('View datacards', 'view-datacards') + button('Export datacards', 'export-datacards', { glyph: 'download' }) : '';
  const rosterActions = `<div class="actions">${datacardActions}${button('Add Anvil hero', 'new-anvil-hero', { glyph: 'plus' })}${add('Add unit', 'new-unit')}</div>`;
  return title + `<div class="layout roster-layout">${selector}<div class="stack">${summary}
    ${section('Order of battle', unitCards(sorted.filter(Ledger.battleReady), 'No units ready for battle'), rosterActions)}
    ${section('Reserved', unitCards(sorted.filter(unit => unit.status === 'In Reserves'), 'No units in reserves'))}
    ${section('Retired', unitCards(sorted.filter(unit => unit.status === 'Retired'), 'No retired units'))}
    ${section(`${CampaignStore.data.campaign.resource} ledger`, `<p class="meta" style="margin-bottom:12px">Current balance <strong class="gold">${fmt(Ledger.balance(CampaignStore.data, a))}</strong></p>${history}`, button('Adjust balance', 'new-resource'))}</div></div>`;
}

function unitCard(a, unit) {
  const renown = unitRenown(a, unit, CampaignStore.data.battles);
  const entry = unitCatalogueEntry(a, unit);
  const profile = unitProfile(a, unit, entry);
  const size = Ledger.unitSize(unit, entry?.size);
  const type = Ledger.unitType(unit.type);
  const summary = [type, unit.warscroll === type ? '' : unit.warscroll, `${fmt(Ledger.unitPoints(unit))} pts`].filter(Boolean).join(' · ');
  return `<article class="card unit-card"><div class="unit-card-header"><h3>${escape(Ledger.unitName(unit))}</h3><div class="unit-card-badges">${Ledger.warlord(a)?.id === unit.id ? badge('Warlord') : ''}${unit.anvil ? badge('Anvil hero', 'anvil-hero') : ''}${unit.reinforced ? badge('Reinforced') : ''}${badge(unit.status)}</div></div><p class="meta">${escape(summary)}</p>
    <p class="facts meta">${size ? `<span><strong>${fmt(size)}</strong> ${size === 1 ? 'model' : 'models'}</span>` : ''}<span><strong>${fmt(renown)}</strong> Renown</span>${unit.rank ? `<span>${escape(unit.rank)}</span>` : ''}${unit.path ? `<span>${escape(unit.path)}</span>` : ''}</p>
    ${span('Enhancements', unit.enhancements)}${span('Scars', unit.scars)}${unit.notes ? `<p class="meta copy">${escape(unit.notes)}</p>` : ''}
    ${profile ? `<p class="meta">${Object.entries(Ledger.profileStats).filter(([key]) => profile[key]).map(([key, label]) => `${escape(profile[key])} ${label}`).join(' · ')}</p>` : ''}
    <div class="actions">${unit.status === 'Retired' ? '' : button('Datacard', 'view-unit-datacard', { id: unit.id, title: `View ${unit.name} datacard` })}${button('Edit', 'edit-unit', { id: unit.id })}${button('Renown history', 'unit-history', { id: unit.id, type: 'link' })}</div></article>`;
}

function warbandForm(existing) {
  const a = existing || {};
  const heroes = Ledger.sortedUnits(a.units ?? []).filter(unit => Ledger.unitType(unit.type) === 'Hero');
  const warlordOptions = [['', heroes.length ? 'No warlord selected' : 'Add a Hero to choose a warlord'], ...heroes.map(unit => [unit.id, Ledger.unitName(unit)])];
  formDialog(existing ? 'Edit warband' : 'New warband', field('Warband name', 'name', a.name, { required: true }) + textPicker('Faction', 'faction', a.faction, { required: true }) +
    textPicker('Battle Formation', 'formation', a.formation) +
    select('Warlord or general', 'warlordId', warlordOptions, a.warlordId || '') + field('Banner color', 'color', Ledger.validColor(a.color), { type: 'color' }) + area('Warband notes', 'notes', a.notes), v => {
    const values = { name: required(v.name, 'Warband name'), faction: required(v.faction, 'Faction'), formation: v.formation?.trim() ?? '', warlordId: heroes.some(unit => unit.id === v.warlordId) ? v.warlordId : '', warlord: '', notes: v.notes.trim(), color: Ledger.validColor(v.color) };
    if (existing) Object.assign(existing, values);
    else {
      const id = Ledger.id();
      CampaignStore.data.armies.push({ id, ...values, archived: false, units: [], lores: [], quests: [], ledger: [] });
      CampaignStore.data.activeArmyId = id;
    }
    return ['Warband saved.', 'warbands'];
  }, { label: existing ? 'Save warband' : 'Create warband' });
  const form = dialog.querySelector('#editor-form');
  const formations = [...new Set(CampaignStore.data.armies.map(warband => warband.formation).filter(Boolean))].sort((left, right) => left.localeCompare(right));
  mountTextPicker(form, 'faction', BattleCatalogue.factions.map(name => ({ name })));
  mountTextPicker(form, 'formation', formations.map(name => ({ name })));
}

function unitForm(a, existing, { anvilHero = false } = {}) {
  const u = existing || {};
  const usesAnvil = anvilHero || Boolean(u.anvil);
  const history = existing ? Ledger.battleRenown(CampaignStore.data, a.id, u.id) : 0;
  const remove = existing ? button('Remove unit', 'remove-unit', { id: u.id, type: 'danger' }) : '';
  const entry = existing && unitCatalogueEntry(a, existing);
  const initialProfile = existing ? referenceUnitProfile(a, u, entry) : undefined;
  let profileEditor;
  let anvilEditor;
  let upgradeEditor;
  const title = existing ? `Edit ${u.name}` : usesAnvil ? 'Add Anvil of Apotheosis hero' : `Add unit to ${a.name}`;
  const typeField = usesAnvil ? '<input type="hidden" name="type" value="Hero">' : select('Unit type', 'type', Ledger.unitTypes, existing ? Ledger.unitType(u.type) : 'Infantry');
  const warscrollField = usesAnvil ? anvilWarscrollField(u.warscroll) : textPicker('Warscroll', 'warscroll', u.warscroll, { full: true });
  const pointsLabel = usesAnvil ? 'Battle point cost' : 'Base points';
  formDialog(title,
    warscrollField + field('Unit name', 'name', u.name, { placeholder: 'Defaults to the warscroll name' }) +
    `<div class="full" id="unit-catalogue-values" hidden><div class="actions"><p class="meta" id="unit-catalogue-summary"></p><button type="button" class="button secondary" id="apply-unit-catalogue">Apply listed values</button></div></div>` +
    typeField + field(pointsLabel, 'points', u.points ?? 0, { type: 'number', min: 0 }) +
    field('Base model count', 'size', u.size ?? entry?.size ?? '', { type: 'number', min: 1 }) + field('Base Renown', 'renown', u.renown ?? 0, { type: 'number', min: 0 }) +
    `<div class="full reinforcement"><label><input type="checkbox" name="reinforced" value="on"${u.reinforced ? ' checked' : ''}> Reinforced</label><p class="meta" id="unit-totals" aria-live="polite"></p></div>` +
    select('Status', 'status', Ledger.unitStatuses, u.status || 'Active') + field('Rank', 'rank', u.rank) + field('Path', 'path', u.path) +
    (usesAnvil ? anvilFields(u.anvil) : '') + unitUpgradeFields() + profileEditorFields(!initialProfile) + area('Enhancement notes', 'enhancements', u.enhancements) + area('Scars and injuries', 'scars', u.scars) + area('Unit notes', 'notes', u.notes), (v, form) => {
    const { type, status, rank, path, enhancements, scars, notes } = v;
    const reinforced = v.reinforced === 'on';
    const size = v.size === '' ? null : whole(v.size, 'Base model count', 1);
    if (reinforced && size === null) throw new Error('Enter the base model count for a reinforced unit.');
    const warscroll = form.elements.warscroll.value.trim();
    const values = { type: usesAnvil ? 'Hero' : Ledger.unitType(type), status, rank, path, enhancements, scars, notes, name: required(v.name.trim() || warscroll, 'Unit name or warscroll'), warscroll, points: whole(v.points, pointsLabel, 0),
      size, reinforced, renown: whole(v.renown, 'Base Renown', 0), profileEdits: profileEditor.changes(), anvil: anvilEditor?.read() ?? null, upgrades: upgradeEditor.read(true) };
    if (existing) Object.assign(existing, values);
    else a.units.push({ id: Ledger.id(), ...values });
    if (!Ledger.warlord(a)) a.warlordId = '';
    return ['Unit saved.', 'warbands'];
  }, { label: usesAnvil ? 'Save hero' : 'Save unit', remove, description: usesAnvil ? 'Choose a warscroll to fill in the starting battle point cost and Destiny Point limit.' : history ? `Battle history contributes ${Ledger.signed(history)} Renown to this unit’s total.` : 'Use base Renown for progress earned before you began logging battles here.' });
  const form = dialog.querySelector('#editor-form');
  const fields = form.elements;
  if (usesAnvil) anvilEditor = mountAnvilEditor(form, u.anvil);
  else mountTextPicker(form, 'warscroll', BattleCatalogue.list(a.faction).map(entry => ({ ...entry, detail: [fmt(entry.points) + ' pts', modelCount(entry.size), entry.kind].filter(Boolean).join(' · ') })));
  profileEditor = attachProfileEditor(form, initialProfile, u.profileEdits);
  const total = form.querySelector('#unit-totals');
  const refreshTotals = () => {
    const reinforced = fields.reinforced.checked;
    const draft = { reinforced, points: Math.max(0, Ledger.integer(fields.points.value)), size: Ledger.integer(fields.size.value) || null, upgrades: upgradeEditor.read() };
    const size = Ledger.unitSize(draft);
    fields.size.required = reinforced;
    total.textContent = [`Total ${fmt(Ledger.unitPoints(draft))} pts`, size > 0 ? modelCount(size) : reinforced ? 'Enter the base model count' : ''].filter(Boolean).join(' · ');
  };
  upgradeEditor = mountUnitUpgrades(form, u.upgrades, refreshTotals);
  form.addEventListener('invalid', event => {
    const section = event.target.closest('details');
    if (section) section.open = true;
  }, true);
  fields.reinforced.addEventListener('change', refreshTotals);
  fields.points.addEventListener('input', refreshTotals);
  fields.size.addEventListener('input', refreshTotals);
  let suggestedName = '';
  const selected = () => unitCatalogueEntry(a, { warscroll: fields.warscroll.value, name: fields.name.value });
  const suggestUnitName = name => {
    if (name && (!fields.name.value.trim() || fields.name.value === suggestedName)) {
      fields.name.value = name;
      suggestedName = name;
    }
  };
  const apply = record => {
    if (!record) return;
    fields.warscroll.value = record.name;
    suggestUnitName(record.name);
    fields.type.value = usesAnvil ? 'Hero' : Ledger.unitType(record.category);
    fields.points.value = record.points;
    fields.size.value = record.size;
  };
  const refreshReference = () => {
    const current = { warscroll: fields.warscroll.value, name: fields.name.value };
    const record = unitCatalogueEntry(a, current);
    profileEditor.rebase(referenceUnitProfile(a, current, record));
    form.querySelector('#unit-catalogue-values').hidden = !record;
    form.querySelector('#unit-catalogue-summary').textContent = record ? `${fmt(record.points)} listed points · ${modelCount(record.size)}${record.kind ? ` · ${record.kind}` : ''}` : '';
    refreshTotals();
  };
  fields.warscroll.addEventListener('change', () => {
    if (usesAnvil) {
      const preset = anvilWarscrolls.get(fields.warscroll.value);
      if (preset) {
        fields.points.value = preset.points;
        anvilEditor.setLimit(preset.limit);
      }
    } else if (!existing) {
      const record = selected();
      if (record) apply(record);
      else suggestUnitName(fields.warscroll.value.trim());
    }
    refreshReference();
  });
  fields.name.addEventListener('change', refreshReference);
  form.querySelector('#apply-unit-catalogue').addEventListener('click', () => { apply(selected()); refreshReference(); });
  refreshReference();
}

function unitHistory(a, u) {
  const history = Ledger.unitHistory(CampaignStore.data, a.id, u.id);
  const total = u.renown + history.reduce((sum, award) => sum + award.delta, 0);
  const list = history.map(row => `<div class="list-item split"><div><strong>${escape(row.title)}</strong><p class="meta">${makeDate(row.date)}</p></div>${signed(row.delta)}</div>`).join('');
  viewDialog(`${u.name} · Renown`, `<p><strong class="gold">${fmt(total)}</strong> total Renown</p><p class="meta">Base Renown · ${fmt(u.renown)}</p>${list || empty('No battle awards yet', '')}`);
}

function resourceForm(a, existing) {
  const row = existing || {};
  formDialog(existing ? 'Edit adjustment' : `Adjust ${CampaignStore.data.campaign.resource}`,
    field('Date', 'date', row.date || Ledger.date(), { type: 'date', required: true }) + field('Change', 'delta', row.delta ?? 0, { type: 'number', required: true }) +
    field('Reason', 'reason', row.reason, { required: true, full: true }), v => {
    const values = { date: v.date, reason: required(v.reason, 'Reason'), delta: whole(v.delta, 'Change') };
    if (!values.delta) throw new Error('Enter a gain or expenditure greater than zero.');
    if (existing) Object.assign(existing, values);
    else a.ledger.push({ id: Ledger.id(), ...values });
    return ['Resource adjustment saved.', 'warbands'];
  }, { label: 'Save adjustment', description: 'Use a positive number for gains and a negative number for spending.', remove: existing ? button('Delete adjustment', 'remove-resource', { id: row.id, type: 'danger' }) : '' });
}
