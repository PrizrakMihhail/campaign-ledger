'use strict';

const filters = { query: '', result: '' };

function resetBattleFilters() {
  Object.assign(filters, { query: '', result: '' });
}

function battleRow(b, perspective) {
  const first = army(b.armyId)?.name || 'Unknown warband';
  const second = army(b.opponentArmyId)?.name || b.opponent || 'External opponent';
  const result = Ledger.resultFor(b, perspective);
  return `<div class="list-item"><button type="button" class="list-button row" data-action="view-battle" data-id="${escape(b.id)}">${tile('swords')}<span class="row-main"><strong class="row-title">${escape(b.title)}</strong><span class="meta row-sub">${escape(first)} vs ${escape(second)} · ${makeDate(b.date)}</span></span>${badge(result)}</button></div>`;
}

function battles() {
  const warband = viewedArmy();
  const title = heading('Battles', warband?.name, warband && !warband.archived ? add('Record battle', 'new-battle') : '');
  if (!warband) return title + empty('No warband selected', 'Select or create a warband to view its battles.', pageLink('View warbands', 'warbands'));
  return title + section('Battle record',
    `<div class="filter-row" id="battle-filters">${field('Search', 'query', filters.query, { placeholder: 'Search battles', type: 'search' })}${select('Result', 'result', [['', 'All results'], ...Ledger.resultOptions], filters.result)}</div><div id="battle-results">${battleResults()}</div>`);
}

function battleResults() {
  const search = filters.query.toLowerCase().trim();
  const warband = viewedArmy();
  const battles = warbandBattles(warband);
  const rows = battles.filter(b => {
    if (filters.result && Ledger.resultFor(b, warband.id) !== filters.result) return false;
    return !search || [b.title, b.battleplan, b.opponent, b.notes, ...Ledger.participants(b).map(id => army(id)?.name)].some(v => v?.toLowerCase().includes(search));
  });
  if (rows.length) return rows.map(battle => battleRow(battle, warband.id)).join('');
  if (battles.length) return empty('No matching battles', 'Try a different search or filter.');
  return empty('No battles yet', warband?.archived ? '' : 'Record your first result to start the battle history.');
}

function battleForm(existing, seed) {
  const b = existing || {};
  const c = CampaignStore.data.campaign;
  const eligible = CampaignStore.data.armies.filter(a => !a.archived || (existing && Ledger.participants(b).includes(a.id)));
  const primary = b.armyId || eligible.find(a => a.id === (seed?.armyId ?? viewedArmy()?.id))?.id || eligible[0]?.id;
  if (!primary) {
    tell('Create or restore a warband to record a battle.', true);
    return;
  }
  const firstOptions = armyOptions(seed ? eligible.filter(a => a.id === primary) : eligible);
  if (b.armyId && !army(b.armyId)) firstOptions.push([b.armyId, 'Unknown warband']);
  const drafts = new Map();
  const awardKey = (armyId, unitId) => JSON.stringify([armyId, unitId]);
  for (const award of b.awards ?? seed?.awards ?? []) drafts.set(awardKey(award.armyId, award.unitId), award);
  const questDrafts = new Map([[primary, b.questPoints ?? seed?.questPoints ?? seed?.awards.reduce((sum, award) => sum + award.questPoints, 0) ?? 0]]);
  let questArmyId;

  function questTarget(armyId) {
    const warband = army(armyId);
    if (b.questId && b.armyId === armyId) return warband?.quests.find(quest => quest.id === b.questId) ?? { id: b.questId, title: 'Removed quest' };
    return Ledger.activeQuest(warband);
  }

  function readRows(form) {
    return [...form.querySelectorAll('[data-award]')].map(row => {
      const { army: armyId, unit: unitId, name: unitName } = row.dataset;
      return { armyId, unitId, unitName, delta: row.querySelector('[data-renown]').value, scars: row.querySelector('[data-scars]').value };
    });
  }

  function refreshParticipants(form) {
    const fields = form.elements;
    for (const award of readRows(form)) {
      const key = awardKey(award.armyId, award.unitId);
      drafts.set(key, { ...drafts.get(key), ...award });
    }

    const yourArmy = fields.armyId.value;
    if (questArmyId) questDrafts.set(questArmyId, fields.questPoints.value);
    const quest = questTarget(yourArmy);
    fields.questPoints.disabled = !quest;
    fields.questPoints.value = quest ? questDrafts.get(yourArmy) ?? 0 : 0;
    form.querySelector('#battle-quest-target').textContent = quest ? quest.title : 'No active quest for this warband.';
    questArmyId = yourArmy;
    const opponent = fields.opponentArmyId.value;
    const options = [['', 'External opponent'], ...armyOptions(eligible.filter(a => a.id !== yourArmy))];
    if (b.opponentArmyId && !army(b.opponentArmyId) && b.opponentArmyId !== yourArmy) options.push([b.opponentArmyId, 'Unknown warband']);
    fields.opponentArmyId.replaceChildren(...options.map(([key, label]) => new Option(label, key)));
    fields.opponentArmyId.value = options.some(([key]) => key === opponent) ? opponent : '';
    fields.opponent.disabled = Boolean(fields.opponentArmyId.value);
    fields.oppDelta.disabled = !fields.opponentArmyId.value;
    if (fields.oppResourceDelta) fields.oppResourceDelta.disabled = fields.oppDelta.disabled;

    const ids = [yourArmy, fields.opponentArmyId.value].filter(Boolean);
    let index = 0;
    form.querySelector('#battle-awards').innerHTML = ids.map(id => {
      const a = army(id);
      const units = new Map((a?.units || []).filter(u => Ledger.battleReady(u, id, CampaignStore.data.battles) || drafts.has(awardKey(id, u.id))).map(u => [u.id, u.name]));
      for (const award of drafts.values()) if (award.armyId === id && !units.has(award.unitId)) units.set(award.unitId, award.unitName || 'Removed unit');
      if (!units.size) return '';
      const rows = [...units].map(([unitId, name]) => {
        const previous = drafts.get(awardKey(id, unitId));
        const stats = battleStatsText(previous);
        const fieldId = `award-${++index}`;
        return `<tr data-award data-army="${escape(id)}" data-unit="${escape(unitId)}" data-name="${escape(name)}">
          <th scope="row">${escape(name)}${stats ? `<span class="meta row-sub">${stats}</span>` : ''}</th>
          <td><input name="${fieldId}-renown" type="number" min="0" step="1" value="${escape(previous?.delta || '')}" placeholder="0" aria-label="Renown for ${escape(name)}" data-renown></td>
          <td><input name="${fieldId}-scars" type="number" min="0" step="1" value="${escape(previous?.scars || '')}" placeholder="0" aria-label="Battle Scars for ${escape(name)}" data-scars></td>
        </tr>`;
      }).join('');
      return `<div class="award-group"><h3>${escape(a?.name || 'Unknown warband')}</h3><div class="table-scroll">
        <table class="battle-awards"><thead><tr><th scope="col">Unit</th><th scope="col">Renown</th><th scope="col">Battle Scars</th></tr></thead><tbody>${rows}</tbody></table>
      </div></div>`;
    }).join('') || '<p class="meta">Add battle-ready units to the participating warbands to log awards here.</p>';
  }

  const fields = field('Battle title', 'title', b.title, { full: true, required: true }) + field('Date', 'date', b.date || Ledger.date(), { type: 'date', required: true }) +
    field('Battleplan', 'battleplan', b.battleplan) + select('Warband', 'armyId', firstOptions, primary) + select('Opponent warband', 'opponentArmyId', [['', 'External opponent'], ...armyOptions(eligible), ...(b.opponentArmyId && !army(b.opponentArmyId) ? [[b.opponentArmyId, 'Unknown warband']] : [])], b.opponentArmyId || '') +
    field('External opponent name', 'opponent', b.opponent) + select('Result for selected warband', 'result', Ledger.resultOptions, b.result || 'Victory') +
    field('Warband Glory Points change', 'delta', b.delta ?? 0, { type: 'number' }) + field('Opponent Glory Points change', 'oppDelta', b.oppDelta ?? 0, { type: 'number' }) +
    (c.resource ? field(`Warband ${c.resource} change`, 'resourceDelta', b.resourceDelta ?? 0, { type: 'number' }) +
      field(`Opponent ${c.resource} change`, 'oppResourceDelta', b.oppResourceDelta ?? 0, { type: 'number' }) : '') +
    field('Quest points acquired', 'questPoints', 0, { type: 'number', min: 0 }) + '<p class="meta battle-quest-target" id="battle-quest-target"></p>' +
    `<fieldset class="awards full"><legend>Unit aftermath</legend><p class="meta">Enter Renown earned and Battle Scars gained in this battle.</p><div id="battle-awards"></div></fieldset>` + area('Aftermath notes', 'notes', b.notes, 4);
  formDialog(existing ? 'Edit battle' : 'Record battle', fields, (v, form) => {
    if (v.opponentArmyId === v.armyId) throw new Error('Choose a different opponent warband.');
    const questPoints = whole(v.questPoints ?? 0, 'Quest points acquired', 0);
    const quest = questTarget(v.armyId);
    if (questPoints && !quest) throw new Error('Start a quest for this warband before awarding Quest Points.');
    const awards = readRows(form).flatMap(award => {
      const delta = whole(award.delta, 'Renown award', 0);
      const scars = whole(award.scars, 'Battle Scars gained', 0);
      const previous = drafts.get(awardKey(award.armyId, award.unitId));
      const stats = Ledger.unitBattleStats(previous ?? {});
      if (!delta && !scars && !stats.kills && !stats.questPoints && !stats.dead) return [];
      return [{ ...award, id: previous?.id || Ledger.id(), delta, scars, ...stats }];
    });
    const values = { title: required(v.title, 'Battle title'), date: v.date, armyId: v.armyId, opponentArmyId: v.opponentArmyId, opponent: v.opponent?.trim() || '',
      result: v.result, battleplan: v.battleplan.trim(), notes: v.notes.trim(), delta: whole(v.delta, 'Warband Glory Points change'), oppDelta: whole(v.oppDelta ?? 0, 'Opponent Glory Points change'),
      resourceDelta: c.resource ? whole(v.resourceDelta, 'Warband campaign resource change') : b.resourceDelta ?? 0,
      oppResourceDelta: c.resource ? whole(v.oppResourceDelta ?? 0, 'Opponent campaign resource change') : b.oppResourceDelta ?? 0,
      questId: quest?.id ?? '', questPoints, rounds: Ledger.normalizeBattleRounds(b.rounds ?? seed?.rounds), awards };
    if (existing) Object.assign(existing, values);
    else CampaignStore.data.battles.push({ id: Ledger.id(), ...values });
    if (seed && seed.armyId === v.armyId) {
      const warband = army(v.armyId);
      warband.battleView = [];
      warband.battleViewQuestPoints = 0;
      warband.battleRounds = Ledger.normalizeBattleRounds();
      clearBattleViewChanges();
    }
    resetBattleFilters();
    return ['Battle saved.', 'battles'];
  }, { label: 'Save battle', remove: existing ? button('Delete battle', 'remove-battle', { id: b.id, type: 'danger' }) : '' });

  const form = dialog.querySelector('form');
  refreshParticipants(form);
  form.addEventListener('change', event => {
    if (['armyId', 'opponentArmyId'].includes(event.target.name)) refreshParticipants(form);
  });
}

function battleStatsText(stats) {
  if (!stats) return '';
  return [
    stats.kills ? `${fmt(stats.kills)} ${stats.kills === 1 ? 'kill' : 'kills'}` : '',
    stats.questPoints ? `${fmt(stats.questPoints)} Quest ${stats.questPoints === 1 ? 'Point' : 'Points'}` : '',
    stats.dead ? 'Dead' : '',
  ].filter(Boolean).join(' · ');
}

function viewBattle(b) {
  const first = army(b.armyId)?.name || 'Unknown warband';
  const second = army(b.opponentArmyId)?.name || b.opponent || 'External opponent';
  const resource = CampaignStore.data.campaign.resource;
  const quest = army(b.armyId)?.quests.find(quest => quest.id === b.questId);
  const changes = (label, delta, opponentDelta) => `<p class="meta">${escape(label)} · ${escape(first)} ${signed(delta)}${b.opponentArmyId ? ` · ${escape(second)} ${signed(opponentDelta)}` : ''}</p>`;
  const awards = b.awards.map(a => {
    const owner = army(a.armyId);
    const name = owner?.units.find(u => u.id === a.unitId)?.name || a.unitName || 'Removed unit';
    const stats = battleStatsText(a);
    return `<div class="list-item split"><p>${escape(name)} <span class="meta">${escape(owner?.name || '')}</span></p><div class="facts meta">
      ${a.delta ? `<span>${signed(a.delta)} Renown</span>` : ''}${a.scars ? `<span>${signed(a.scars)} Battle Scars</span>` : ''}
      ${stats ? `<span>${stats}</span>` : ''}</div></div>`;
  }).join('');
  viewDialog(b.title, `<div class="split"><p class="meta">${makeDate(b.date)}${b.battleplan ? ` · ${escape(b.battleplan)}` : ''}</p>${badge(b.result)}</div>
    <p><strong>${escape(first)}</strong> vs ${escape(second)}</p>${changes(Ledger.gloryPoints, b.delta, b.oppDelta)}
    ${resource ? changes(resource, b.resourceDelta, b.oppResourceDelta) : ''}${b.questPoints ? span('Quest Points acquired', `${fmt(b.questPoints)} · ${quest?.title ?? 'Removed quest'}`) : ''}${b.notes ? `<p class="copy">${escape(b.notes)}</p>` : ''}
    ${recordedBattleRounds(b.rounds, first, second)}
    ${awards ? `<div><h3>Unit aftermath</h3>${awards}</div>` : ''}`, button('Edit battle', 'edit-battle', { id: b.id, type: 'primary' }));
}

function updateFilters(event) {
  const input = event.target;
  if (!input.closest('#battle-filters')) return;
  filters[input.name] = input.value;
  document.querySelector('#battle-results').innerHTML = battleResults();
}
