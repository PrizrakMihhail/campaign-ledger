'use strict';

function warbandRow(a) {
  return `<div class="list-item"><a class="list-button row" href="#warbands">${tile('shield', a.color)}<span class="row-main"><strong class="row-title">${escape(a.name)}</strong><span class="meta row-sub">${escape([a.faction, `${fmt(Ledger.points(a, CampaignStore.data.battles))} pts`].filter(Boolean).join(' · '))}</span></span>${a.archived ? badge('Archived', 'retired') : ''}</a></div>`;
}

function warbands() {
  const title = heading('Warbands', 'Order of battle, unit progression, and resource ledgers.', button('Profile library', 'profile-library', { glyph: 'book' }) + add('New warband', 'new-warband'));
  const a = viewedArmy();
  if (!a) return title + (CampaignStore.data.armies.length
    ? empty('No Active warband', 'Select an archived warband to restore it, or create a new one.')
    : empty('No warbands yet', 'Create a warband to start tracking a roster and its progress.'));
  const rec = Ledger.record(CampaignStore.data, a.id);
  const warlord = Ledger.warlord(a);
  const battles = CampaignStore.data.battles;
  const points = Ledger.points(a, battles);
  const lorePoints = Ledger.lorePoints(a);
  const cap = CampaignStore.data.campaign.pointsLimit;
  const isActive = a.id === CampaignStore.data.activeWarbandId;
  const summary = `<section class="panel stack"><div class="split">${tile('shield', a.color)}<div class="row-main"><h2>${escape(a.name)}</h2><p class="meta">${escape(a.faction)}</p></div>${a.archived ? badge('Archived', 'retired') : isActive ? badge('Active') : ''}</div>
    <div class="facts meta"><span><strong class="${points > cap ? 'negative' : ''}">${fmt(points)} / ${fmt(cap)}</strong> roster pts</span><span><strong>${rec.Victory}–${rec.Defeat}–${rec.Draw}</strong> W–L–D</span>${warlord ? `<span>Warlord · <strong>${escape(Ledger.unitName(warlord))}</strong></span>` : ''}</div>
    <progress class="progress" max="${cap}" value="${Math.min(points, cap)}" aria-label="Roster points reference"></progress>
    ${span('Battle Formation', a.formation)}
    ${lorePoints ? `<p class="meta">Includes ${fmt(lorePoints)} battle pts from Arcane Tome.</p>` : ''}
    ${a.notes ? `<p class="copy muted">${escape(a.notes)}</p>` : ''}<div class="actions">${button('Edit warband', 'edit-warband')}${button('Import faction rules', 'import-warband-rules')}${!a.archived && !isActive ? button('Make Active', 'make-active-warband', { type: 'primary' }) : ''}${button(a.archived ? 'Restore warband' : 'Archive warband', 'archive-warband', { type: 'link' })}${button('Remove warband', 'remove-warband', { type: 'danger' })}</div></section>`;
  const sorted = sortedWarbandUnits(a);
  const unitCards = (units, emptyTitle) => units.length ? `<div class="cards">${units.map(unit => unitCard(a, unit)).join('')}</div>` : empty(emptyTitle, '');
  const resource = CampaignStore.data.campaign.resource;
  const datacardActions = hasWarbandDatacards(a) ? button('View datacards', 'view-datacards') + button('Export datacards', 'export-datacards', { glyph: 'download' }) : '';
  const rosterActions = `<div class="actions">${!a.archived ? pageLink('Battle View', 'battle-view', 'battle') : ''}${datacardActions}${button('Add Anvil hero', 'new-anvil-hero', { glyph: 'plus' })}${add('Add unit', 'new-unit')}</div>`;
  return title + `<div class="stack">${summary}
    ${section('Order of battle', unitCards(sorted.filter(unit => Ledger.battleReady(unit, a.id, battles)), 'No units ready for battle'), rosterActions, 'battle')}
    ${section('Reserved', unitCards(sorted.filter(unit => Ledger.rosterStatus(unit, a.id, battles) === 'In Reserves'), 'No units in reserves'))}
    ${section('Retired', unitCards(sorted.filter(unit => Ledger.rosterStatus(unit, a.id, battles) === 'Retired'), 'No retired units'))}
    ${battleTraitsSection(a)}
    ${warbandLedger(a, Ledger.gloryPoints, 'glory')}
    ${resource ? warbandLedger(a, resource, 'resource') : ''}</div>`;
}

function warbandLedger(a, label, kind) {
  const transactions = Ledger.transactions(CampaignStore.data, a, kind);
  const balance = transactions.reduce((sum, transaction) => sum + transaction.delta, 0);
  const history = transactions.length ? `<div class="table-scroll"><table><thead><tr><th>Date</th><th>Reason</th><th>Change</th><th>Action</th></tr></thead><tbody>${transactions.map(t => `<tr><td class="nowrap">${makeDate(t.date)}</td><td>${escape(t.reason)}</td><td>${signed(t.delta)}</td><td>${t.manual ? button('Edit', 'edit-resource', { id: t.id }) : button('View battle', 'view-battle', { id: t.id, type: 'link' })}</td></tr>`).join('')}</tbody></table></div>` : empty('No changes yet', 'Battle rewards and manual adjustments appear here.');
  return section(`${label} ledger`, `<p class="meta" style="margin-bottom:12px">Current balance <strong class="gold">${fmt(balance)}</strong></p>${history}`,
    button('Adjust balance', 'new-resource', { id: kind, title: `Adjust ${label} balance` }), 'coin');
}

function unitCard(a, unit) {
  const renown = unitRenown(a, unit, CampaignStore.data.battles);
  const entry = unitCatalogueEntry(a, unit);
  const profile = unitProfile(a, unit, entry);
  const size = Ledger.unitSize(unit, entry?.size);
  const type = unitRosterType(a, unit, entry);
  const summary = [type, unit.warscroll === type ? '' : unit.warscroll, `${fmt(Ledger.unitPoints(unit))} pts`].filter(Boolean).join(' · ');
  const battleScars = Ledger.unitBattleScars(unit, a.id, CampaignStore.data.battles);
  const scarSeverity = Ledger.battleScarSeverity(battleScars);
  const status = Ledger.unitStatus(unit.status, battleScars);
  return `<article class="card unit-card"><div class="unit-card-header"><h3>${escape(Ledger.unitName(unit))}</h3><div class="unit-card-badges">${Ledger.warlord(a)?.id === unit.id ? badge('Warlord') : ''}${unit.anvil ? badge('Anvil hero', 'anvil-hero') : ''}${unit.reinforced ? badge('Reinforced') : ''}${badge(status)}</div></div><p class="meta unit-card-type">${unitIcon(type)}<span>${escape(summary)}</span></p>
    <p class="facts meta">${size ? `<span><strong>${fmt(size)}</strong> ${size === 1 ? 'model' : 'models'}</span>` : ''}<span><strong>${fmt(renown)}</strong> Renown</span>${unit.rank ? `<span>${escape(unit.rank)}</span>` : ''}${unit.path ? `<span>${escape(unit.path)}</span>` : ''}</p>
    ${span('Enhancements', unit.enhancements)}${battleScars ? span('Battle Scars', scarSeverity === '-' ? fmt(battleScars) : `${fmt(battleScars)} · ${scarSeverity}`) : ''}${span('Scars', unit.scars)}${unit.notes ? `<p class="meta copy">${escape(unit.notes)}</p>` : ''}
    ${profile ? `<p class="meta">${Object.entries(Ledger.profileStats).filter(([key]) => profile[key]).map(([key, label]) => `${escape(profile[key])} ${label}`).join(' · ')}</p>` : ''}
    <div class="actions">${status === 'Retired' ? '' : button('Datacard', 'view-unit-datacard', { id: unit.id, title: `View ${unit.name} datacard` })}${button('Edit', 'edit-unit', { id: unit.id })}${button('Battle history', 'unit-history', { id: unit.id, type: 'link' })}</div></article>`;
}

function removeWarband(warband) {
  if (!warband) return;
  confirmDialog(`Remove ${warband.name}?`, 'Permanently removes this warband, its units, traits, lores, quests, ledger, and warband chronicle entries. Battles shared with other warbands and their rewards are kept for those warbands; its other battles are deleted. Export a backup first if you may need to restore it.', 'Remove warband', () => {
    const state = CampaignStore.data;
    if (!state.armies.some(item => item.id === warband.id)) return ['Warband already removed.', 'warbands'];
    state.armies = state.armies.filter(item => item.id !== warband.id);
    state.entries = state.entries.filter(entry => entry.armyId !== warband.id);
    state.battles = state.battles.filter(battle => {
      if (!Ledger.participants(battle).includes(warband.id)) return true;
      const survivorId = battle.armyId === warband.id ? battle.opponentArmyId : battle.armyId;
      if (!state.armies.some(item => item.id === survivorId)) return false;
      if (battle.armyId === warband.id) {
        battle.result = Ledger.resultFor(battle, survivorId);
        battle.armyId = survivorId;
        battle.opponentArmyId = '';
        battle.delta = battle.oppDelta;
        battle.resourceDelta = battle.oppResourceDelta;
        battle.oppDelta = 0;
        battle.oppResourceDelta = 0;
        battle.questId = '';
        battle.questPoints = 0;
      } else {
        battle.opponentArmyId = '';
        battle.oppDelta = 0;
        battle.oppResourceDelta = 0;
      }
      battle.opponent = warband.name;
      battle.awards = (battle.awards || []).filter(award => award.armyId !== warband.id);
      return true;
    });
    if (state.activeWarbandId === warband.id) state.activeWarbandId = Ledger.latestWarband(state.armies)?.id || '';
    viewedArmyId = state.activeWarbandId ? '' : state.armies[0]?.id || '';
    return ['Warband permanently removed.', 'warbands'];
  });
}

function warbandForm(existing) {
  const a = existing || {};
  const heroes = Ledger.sortedUnits(a.units ?? []).filter(unit => Ledger.unitType(unit.type) === 'Hero');
  const warlordOptions = [['', heroes.length ? 'No warlord selected' : 'Add a Hero to choose a warlord'], ...heroes.map(unit => [unit.id, Ledger.unitName(unit)])];
  formDialog(existing ? 'Edit warband' : 'New warband', field('Warband name', 'name', a.name, { required: true }) + textPicker('Faction', 'faction', a.faction, { required: true }) +
    textPicker('Battle Formation', 'formation', a.formation) +
    `<div class="full" id="warband-import-options">${warbandImportFields(a.faction, !existing)}</div>` +
    select('Warlord or general', 'warlordId', warlordOptions, a.warlordId || '') + field('Banner color', 'color', Ledger.validColor(a.color), { type: 'color' }) + area('Warband notes', 'notes', a.notes), v => {
    const values = { name: required(v.name, 'Warband name'), faction: required(v.faction, 'Faction'), formation: v.formation?.trim() ?? '', warlordId: heroes.some(unit => unit.id === v.warlordId) ? v.warlordId : '', warlord: '', notes: v.notes.trim(), color: Ledger.validColor(v.color) };
    if (existing) {
      Object.assign(existing, values);
      applyWarbandImport(existing, v);
    }
    else {
      const id = Ledger.id();
      const warband = { id, ...values, archived: false, units: [], lores: [], quests: [], ledger: [], battleTraits: [], battleView: [] };
      applyWarbandImport(warband, v);
      CampaignStore.data.armies.push(warband);
      CampaignStore.data.activeWarbandId = id;
      viewedArmyId = '';
    }
    return ['Warband saved.', 'warbands'];
  }, { label: existing ? 'Save warband' : 'Create warband' });
  const form = dialog.querySelector('#editor-form');
  mountTextPicker(form, 'faction', BattleCatalogue.factions.map(name => ({ name })));
  const formationPicker = mountTextPicker(form, 'formation', []);
  const factionField = form.elements?.faction;
  const refreshFormations = () => {
    const faction = factionField?.value || a.faction;
    const saved = CampaignStore.data.armies.filter(warband => warband.faction?.toLowerCase() === faction?.toLowerCase()).map(warband => warband.formation).filter(Boolean);
    formationPicker?.setEntries([...new Set([...BattleCatalogue.formations(faction), ...saved])].sort((left, right) => left.localeCompare(right)).map(name => ({ name })));
  };
  factionField?.addEventListener('change', refreshFormations);
  factionField?.addEventListener('change', () => {
    const root = form.querySelector('#warband-import-options');
    if (root) root.innerHTML = warbandImportFields(factionField.value, !existing);
  });
  refreshFormations();
}

function warbandImportFields(faction, includeTraits = true) {
  const checkbox = (name, label, checked) => `<label class="full"><input type="checkbox" name="${name}"${checked ? ' checked' : ''}> ${label}</label>`;
  return checkbox('includeFactionRules', 'Add missing faction traits and selected formation abilities', includeTraits) +
    Ledger.loreKinds.map(kind => select(`${loreLabels[kind].title} to import`, `import-${kind}`, [['', 'None — do not add a lore'], ...BattleCatalogue.lores(faction, kind).map((lore, index) => [String(index), `${lore.name}${lore.scope === 'shared' ? ' (Shared)' : ''}`])], '')).join('') +
    checkbox('includeManifestationUnits', 'Add linked manifestation units to the roster', true) +
    '<p class="meta full">Imported items are editable copies. Existing items and customizations are kept; only missing traits, lore entries, and units are added. Shared lores may have army eligibility restrictions; check their Declare text.</p>';
}

function addManifestationUnits(warband, lore) {
  warband.units ??= [];
  for (const item of lore.entries || []) {
    const link = item.manifestation;
    if (!link) continue;
    const record = BattleCatalogue.find(link.faction, link.name);
    if (!record || warband.units.some(unit => unitWarscroll(unit)?.toLowerCase() === record.name.toLowerCase())) continue;
    warband.units.push({ id: Ledger.id(), name: record.name, warscroll: record.name, type: 'Manifestation', points: 0, size: record.size || 1,
      renown: 0, rank: '', path: '', reinforced: false, upgrades: [], status: 'Active', enhancements: '', scars: '', notes: '', battleScars: 0, profileEdits: null, anvil: null });
  }
}

function applyWarbandImport(warband, values) {
  const sameName = (a, b) => a.trim().normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '') === b.trim().normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
  warband.battleTraits ??= [];
  warband.lores ??= [];
  if (values.includeFactionRules === 'on') {
    for (const trait of importedWarbandRules(warband.faction, warband.formation || '').battleTraits) {
      if (!warband.battleTraits.some(saved => sameName(saved.name, trait.name) || sameName(saved.name.split(' — ').at(-1), trait.name))) warband.battleTraits.push(trait);
    }
  }
  for (const kind of Ledger.loreKinds) {
    const selection = values[`import-${kind}`];
    if (selection === undefined || selection === '') continue;
    const source = BattleCatalogue.lores(warband.faction, kind)[Number(selection)];
    if (!source) continue;
    let lore = warband.lores.find(saved => saved.kind === kind && sameName(saved.name, source.name));
    if (!lore) {
      lore = { id: Ledger.id(), name: source.name, kind, points: source.points || 0, entries: [] };
      warband.lores.push(lore);
    }
    for (const entry of source.entries) {
      if (!lore.entries.some(saved => sameName(saved.name, entry.name))) lore.entries.push({ id: Ledger.id(), name: entry.name, value: entry.value || '', declare: entry.declare || '', effect: entry.effect || '' });
    }
    if (values.includeManifestationUnits === 'on') addManifestationUnits(warband, source);
  }
}

function warbandImportForm(warband) {
  if (!warband) return;
  formDialog('Import faction rules', warbandImportFields(warband.faction), values => {
    applyWarbandImport(warband, values);
    return ['Missing faction rules imported.', 'warbands'];
  }, { label: 'Import selected rules', description: `Add rules to ${warband.name} · ${warband.faction}. The current formation is ${warband.formation || 'not selected'}.` });
}

function importedWarbandRules(faction, formation) {
  const rules = BattleCatalogue.rules(faction);
  if (!rules) return { battleTraits: [], lores: [] };
  const ability = item => ({ id: Ledger.id(), name: item.name, timing: item.timing || '', declare: item.declare || '', effect: item.effect || '' });
  const selectedFormation = rules.battleFormations?.find(item => item.name.toLowerCase() === formation.toLowerCase());
  const battleTraits = [...(rules.battleTraits || []), ...(selectedFormation?.abilities || [])].map(ability);
  const lores = Object.values(rules.lores || {}).flat().map(lore => ({
    id: Ledger.id(), kind: lore.kind, name: lore.name, points: lore.points || 0,
    entries: lore.entries.map(entry => ({ id: Ledger.id(), name: entry.name, value: entry.value || '', declare: entry.declare || '', effect: entry.effect || '' })),
  }));
  return { battleTraits, lores };
}

function unitForm(a, existing, { anvilHero = false } = {}) {
  const u = existing || {};
  const usesAnvil = anvilHero || Boolean(u.anvil);
  const history = existing ? Ledger.battleRenown(CampaignStore.data, a.id, u.id) : 0;
  const awardedScars = existing ? Ledger.battleScarAwards(CampaignStore.data.battles, a.id, u.id) : 0;
  let statusBeforeRetirement;
  const remove = existing ? button('Remove unit', 'remove-unit', { id: u.id, type: 'danger' }) : '';
  const entry = existing && unitCatalogueEntry(a, existing);
  const initialProfile = existing ? referenceUnitProfile(a, u, entry) : undefined;
  let profileEditor;
  let anvilEditor;
  let upgradeEditor;
  const title = existing ? `Edit ${u.name}` : usesAnvil ? 'Add Anvil of Apotheosis hero' : `Add unit to ${a.name}`;
  const typeField = usesAnvil ? '<input type="hidden" name="type" value="Hero">' : select('Unit type', 'type', Ledger.unitTypes, existing ? unitRosterType(a, u, entry) : 'Infantry');
  const warscrollField = usesAnvil ? anvilWarscrollField(u.warscroll) : textPicker('Warscroll', 'warscroll', u.warscroll, { full: true });
  const pointsLabel = usesAnvil ? 'Battle point cost' : 'Base points';
  formDialog(title,
    warscrollField + field('Unit name', 'name', u.name, { placeholder: 'Defaults to the warscroll name' }) +
    `<div class="full" id="unit-catalogue-values" hidden><div class="actions"><p class="meta" id="unit-catalogue-summary"></p><button type="button" class="button secondary" id="apply-unit-catalogue">Apply listed values</button></div></div>` +
    typeField + field(pointsLabel, 'points', u.points ?? 0, { type: 'number', min: 0 }) +
    field('Base model count', 'size', u.size ?? entry?.size ?? '', { type: 'number', min: 1 }) + field('Base Renown', 'renown', u.renown ?? 0, { type: 'number', min: 0 }) +
    `<div class="full reinforcement"><label><input type="checkbox" name="reinforced" value="on"${u.reinforced ? ' checked' : ''}> Reinforced</label><p class="meta" id="unit-totals" aria-live="polite"></p></div>` +
    select('Status', 'status', Ledger.unitStatuses, u.status || 'Active') + field('Rank', 'rank', u.rank) + field('Path', 'path', u.path) +
    `<div class="full battle-scar-field">${field(awardedScars ? 'Base Battle Scars' : 'Battle Scars', 'battleScars', u.battleScars ?? 0, { type: 'number', min: 0 })}
      <output class="meta" id="battle-scar-severity" for="field-battleScars" aria-live="polite"></output></div>` +
    (usesAnvil ? anvilFields(u.anvil) : '') + unitUpgradeFields() + profileEditorFields(!initialProfile) + area('Enhancement notes', 'enhancements', u.enhancements) + area('Scars and injuries', 'scars', u.scars) + area('Unit notes', 'notes', u.notes), (v, form) => {
    const { type, status, rank, path, enhancements, scars, notes } = v;
    const battleScars = whole(v.battleScars, 'Battle Scars', 0);
    const reinforced = v.reinforced === 'on';
    const size = v.size === '' ? null : whole(v.size, 'Base model count', 1);
    if (reinforced && size === null) throw new Error('Enter the base model count for a reinforced unit.');
    const warscroll = form.elements.warscroll.value.trim();
    const values = { type: usesAnvil ? 'Hero' : Ledger.unitType(type), status: Ledger.unitStatus(statusBeforeRetirement ?? status, battleScars), rank, path, enhancements, scars, notes, name: required(v.name.trim() || warscroll, 'Unit name or warscroll'), warscroll, points: whole(v.points, pointsLabel, 0),
      size, reinforced, battleScars,
      renown: whole(v.renown, 'Base Renown', 0), profileEdits: profileEditor.changes(), anvil: anvilEditor?.read() ?? null, upgrades: upgradeEditor.read(true) };
    if (existing) Object.assign(existing, values);
    else a.units.push({ id: Ledger.id(), ...values });
    if (!Ledger.warlord(a)) a.warlordId = '';
    return ['Unit saved.', 'warbands'];
  }, { label: usesAnvil ? 'Save hero' : 'Save unit', remove, description: usesAnvil ? 'Choose a warscroll to fill in the starting battle point cost and Destiny Point limit.' : history ? `Battle history contributes ${Ledger.signed(history)} Renown to this unit’s total.` : 'Use base Renown for progress earned before you began logging battles here.' });
  const form = dialog.querySelector('#editor-form');
  const fields = form.elements;
  const severity = form.querySelector('#battle-scar-severity');
  function refreshScars() {
    const count = Ledger.integer(fields.battleScars.value) + awardedScars;
    const label = Ledger.battleScarSeverity(count);
    severity.textContent = awardedScars ? `${fmt(count)} total (${fmt(awardedScars)} from battles) · ${label}` : label;
    const mustRetire = Ledger.unitStatus('Active', count) === 'Retired';
    if (mustRetire) {
      statusBeforeRetirement ??= fields.status.value;
      fields.status.value = 'Retired';
    } else if (statusBeforeRetirement !== undefined) {
      fields.status.value = statusBeforeRetirement;
      statusBeforeRetirement = undefined;
    }
    fields.status.disabled = mustRetire;
  }
  fields.battleScars.addEventListener('input', refreshScars);
  refreshScars();
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
  const scars = Ledger.unitBattleScars(u, a.id, CampaignStore.data.battles);
  const list = history.map(row => `<div class="list-item split"><div><strong>${escape(row.title)}</strong><p class="meta">${makeDate(row.date)}</p></div>
    <div class="facts meta">${row.delta ? `<span>${signed(row.delta)} Renown</span>` : ''}${row.scars ? `<span>${signed(row.scars)} Battle Scars</span>` : ''}</div></div>`).join('');
  viewDialog(`${u.name} · Battle history`, `<p><strong class="gold">${fmt(total)}</strong> total Renown</p><p class="meta">Base Renown · ${fmt(u.renown)}</p><p class="meta">Total Battle Scars · ${fmt(scars)}</p>${list || empty('No battle awards yet', '')}`);
}

function resourceForm(a, existing, kind = existing?.kind ?? 'glory') {
  const row = existing || {};
  const label = kind === 'resource' ? CampaignStore.data.campaign.resource : Ledger.gloryPoints;
  formDialog(existing ? `Edit ${label} adjustment` : `Adjust ${label}`,
    field('Date', 'date', row.date || Ledger.date(), { type: 'date', required: true }) + field('Change', 'delta', row.delta ?? 0, { type: 'number', required: true }) +
    field('Reason', 'reason', row.reason, { required: true, full: true }), v => {
    const values = { date: v.date, reason: required(v.reason, 'Reason'), delta: whole(v.delta, 'Change') };
    if (!values.delta) throw new Error('Enter a gain or expenditure greater than zero.');
    if (existing) Object.assign(existing, values);
    else a.ledger.push({ id: Ledger.id(), kind, ...values });
    return ['Resource adjustment saved.', 'warbands'];
  }, { label: 'Save adjustment', description: 'Use a positive number for gains and a negative number for spending.', remove: existing ? button('Delete adjustment', 'remove-resource', { id: row.id, type: 'danger' }) : '' });
}
