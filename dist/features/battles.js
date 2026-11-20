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
        const fieldId = `award-${++index}`;
        return `<tr data-award data-army="${escape(id)}" data-unit="${escape(unitId)}" data-name="${escape(name)}">
          <th scope="row">${escape(name)}</th>
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
    `<fieldset class="awards full"><legend>Unit aftermath</legend><p class="meta">Enter Renown earned and Battle Scars gained in this battle.</p><div id="battle-awards"></div></fieldset>` + area('Aftermath notes', 'notes', b.notes, 4);
  formDialog(existing ? 'Edit battle' : 'Record battle', fields, (v, form) => {
    if (v.opponentArmyId === v.armyId) throw new Error('Choose a different opponent warband.');
    const awards = readRows(form).flatMap(award => {
      const delta = whole(award.delta, 'Renown award', 0);
      const scars = whole(award.scars, 'Battle Scars gained', 0);
      if (!delta && !scars) return [];
      return [{ ...award, id: drafts.get(awardKey(award.armyId, award.unitId))?.id || Ledger.id(), delta, scars }];
    });
    const values = { title: required(v.title, 'Battle title'), date: v.date, armyId: v.armyId, opponentArmyId: v.opponentArmyId, opponent: v.opponent?.trim() || '',
      result: v.result, battleplan: v.battleplan.trim(), notes: v.notes.trim(), delta: whole(v.delta, 'Warband Glory Points change'), oppDelta: whole(v.oppDelta ?? 0, 'Opponent Glory Points change'),
      resourceDelta: c.resource ? whole(v.resourceDelta, 'Warband campaign resource change') : b.resourceDelta ?? 0,
      oppResourceDelta: c.resource ? whole(v.oppResourceDelta ?? 0, 'Opponent campaign resource change') : b.oppResourceDelta ?? 0, awards };
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
  const resource = CampaignStore.data.campaign.resource;
  const changes = (label, delta, opponentDelta) => `<p class="meta">${escape(label)} · ${escape(first)} ${signed(delta)}${b.opponentArmyId ? ` · ${escape(second)} ${signed(opponentDelta)}` : ''}</p>`;
  const awards = b.awards.map(a => {
    const owner = army(a.armyId);
    const name = owner?.units.find(u => u.id === a.unitId)?.name || a.unitName || 'Removed unit';
    return `<div class="list-item split"><p>${escape(name)} <span class="meta">${escape(owner?.name || '')}</span></p><div class="facts meta">
      ${a.delta ? `<span>${signed(a.delta)} Renown</span>` : ''}${a.scars ? `<span>${signed(a.scars)} Battle Scars</span>` : ''}</div></div>`;
  }).join('');
  viewDialog(b.title, `<div class="split"><p class="meta">${makeDate(b.date)}${b.battleplan ? ` · ${escape(b.battleplan)}` : ''}</p>${badge(b.result)}</div>
    <p><strong>${escape(first)}</strong> vs ${escape(second)}</p>${changes(Ledger.gloryPoints, b.delta, b.oppDelta)}
    ${resource ? changes(resource, b.resourceDelta, b.oppResourceDelta) : ''}${b.notes ? `<p class="copy">${escape(b.notes)}</p>` : ''}
    ${awards ? `<div><h3>Unit aftermath</h3>${awards}</div>` : ''}`, button('Edit battle', 'edit-battle', { id: b.id, type: 'primary' }));
}

function updateFilters(event) {
  const input = event.target;
  if (!input.closest('#battle-filters')) return;
  filters[input.name] = input.value;
  document.querySelector('#battle-results').innerHTML = battleResults();
}
