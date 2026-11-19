'use strict';

const filters = { query: '', army: '', result: '' };

function resetBattleFilters() {
  Object.assign(filters, { query: '', army: '', result: '' });
}

function battleRow(b, perspective = b.armyId) {
  const first = army(b.armyId)?.name || 'Unknown warband';
  const second = army(b.opponentArmyId)?.name || b.opponent || 'External opponent';
  const result = Ledger.resultFor(b, perspective);
  return `<div class="list-item"><button type="button" class="list-button row" data-action="view-battle" data-id="${escape(b.id)}">${tile('swords')}<span class="row-main"><strong class="row-title">${escape(b.title)}</strong><span class="meta row-sub">${escape(first)} vs ${escape(second)} · ${makeDate(b.date)}</span></span>${badge(result)}</button></div>`;
}

function battles() {
  return heading('Battles', 'Results, resource changes, and unit Renown awards.', CampaignStore.data.armies.some(a => !a.archived) ? add('Record battle', 'new-battle') : '') + section('Battle record',
    `<div class="filter-row" id="battle-filters">${field('Search', 'query', filters.query, { placeholder: 'Search battles', type: 'search' })}${select('Warband', 'army', [['', 'All warbands'], ...armyOptions()], filters.army)}${select('Result', 'result', [['', 'All results'], ...Ledger.resultOptions], filters.result)}</div><div id="battle-results">${battleResults()}</div>`);
}

function battleResults() {
  const search = filters.query.toLowerCase().trim();
  const rows = sortedBattles().filter(b => {
    if (filters.army && !Ledger.participants(b).includes(filters.army)) return false;
    if (filters.result && Ledger.resultFor(b, filters.army || b.armyId) !== filters.result) return false;
    return !search || [b.title, b.battleplan, b.opponent, b.notes, ...Ledger.participants(b).map(id => army(id)?.name)].some(v => v?.toLowerCase().includes(search));
  });
  if (rows.length) return rows.map(battle => battleRow(battle, filters.army || battle.armyId)).join('');
  if (CampaignStore.data.battles.length) return empty('No matching battles', 'Try a different search or filter.');
  return empty('No battles yet', CampaignStore.data.armies.some(a => !a.archived) ? 'Record your first result to start the battle history.' : 'Create or restore a warband before recording a battle.');
}

function battleForm(existing) {
  const b = existing || {};
  const c = CampaignStore.data.campaign;
  const eligible = CampaignStore.data.armies.filter(a => !a.archived || (existing && Ledger.participants(b).includes(a.id)));
  const primary = b.armyId || eligible.find(a => a.id === CampaignStore.data.activeArmyId)?.id || eligible[0]?.id;
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
    else CampaignStore.data.battles.push({ id: Ledger.id(), ...values });
    resetBattleFilters();
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
    <p><strong>${escape(first)}</strong> vs ${escape(second)}</p><p class="meta">${escape(CampaignStore.data.campaign.resource)} · ${escape(first)} ${signed(b.delta)}${b.opponentArmyId ? ` · ${escape(second)} ${signed(b.oppDelta)}` : ''}</p>${b.notes ? `<p class="copy">${escape(b.notes)}</p>` : ''}
    ${awards ? `<div><h3>Unit Renown awards</h3>${awards}</div>` : ''}`, button('Edit battle', 'edit-battle', { id: b.id, type: 'primary' }));
}

function updateFilters(event) {
  const input = event.target;
  if (!input.closest('#battle-filters')) return;
  filters[input.name] = input.value;
  document.querySelector('#battle-results').innerHTML = battleResults();
}
