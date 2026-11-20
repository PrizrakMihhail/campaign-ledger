'use strict';

function battleView() {
  const warband = viewedArmy();
  const back = pageLink('Back to Warbands', 'warbands');
  const title = heading('Battle View', warband?.name, back +
    (warband && !warband.archived ? button('Record the battle', 'record-battle-view', { type: 'primary', glyph: 'swords' }) : ''));
  if (!warband || warband.archived) return title + empty('No playable warband selected', 'Select an unarchived warband.');

  const battles = CampaignStore.data.battles;
  const draft = new Map(warband.battleView.map(row => [row.id, row]));
  const sorted = battleReadyUnits(warband, battles);
  sorted.sort((a, b) => Number(Boolean(draft.get(a.id)?.dead)) - Number(Boolean(draft.get(b.id)?.dead)));
  const cards = sorted.map(unit => {
    const row = draft.get(unit.id);
    const name = Ledger.unitName(unit);
    const counter = (key, label) => `<label>${label}<input type="number" name="${key}" min="0" step="1" value="${row?.[key] ?? 0}"
      data-battle-counter data-id="${escape(unit.id)}" aria-label="${label} for ${escape(name)}"></label>`;
    return `<section class="battle-view-unit${row?.dead ? ' is-dead' : ''}">
      ${unitDatacard(warband, unit, battles)}
      <div class="battle-view-controls">
        ${counter('kills', 'Kills')}${counter('questPoints', 'Quest Points')}
        <label class="battle-view-dead"><input type="checkbox" name="dead" data-battle-counter data-id="${escape(unit.id)}"
          aria-label="Mark ${escape(name)} dead"${row?.dead ? ' checked' : ''}> Dead</label>
      </div>
    </section>`;
  }).join('');
  return title + (cards ? `<style>${datacardStyles}</style><div class="dc-cards battle-view-grid">${cards}</div>` : empty('No battle-ready units', 'Add units to the warband or move units out of reserves.'));
}

function updateBattleView(input, finalize = false) {
  const warband = viewedArmy();
  const unit = warband?.units.find(item => item.id === input.dataset.id);
  if (!unit || warband.archived || !Ledger.battleReady(unit, warband.id, CampaignStore.data.battles)) return;
  const rows = warband.battleView;
  const index = rows.findIndex(row => row.id === unit.id);
  const previous = rows[index] ?? Ledger.unitBattleStats({});
  const key = input.name;
  if (!['kills', 'questPoints', 'dead'].includes(key)) return;
  const value = key === 'dead' ? input.checked : input.validity.valid ? Ledger.integer(input.value, previous[key]) : previous[key];
  if (key !== 'dead' && finalize) input.value = value;
  if (value === previous[key]) return;
  const row = { ...previous, id: unit.id, [key]: value };
  if (row.dead || row.kills || row.questPoints) {
    if (index < 0) rows.push(row);
    else rows[index] = row;
  } else if (index >= 0) {
    rows.splice(index, 1);
  }
  if (!CampaignStore.save()) tell('Battle View changes could not be saved in this browser.', true);
  if (key === 'dead') {
    render();
    [...main.querySelectorAll('[data-battle-counter][name="dead"]')].find(control => control.dataset.id === unit.id)?.focus({ preventScroll: true });
  }
}

function battleViewSeed(warband, battles) {
  const draft = new Map(warband.battleView.map(row => [row.id, row]));
  return {
    armyId: warband.id,
    awards: battleReadyUnits(warband, battles).map(unit => ({
      ...Ledger.unitBattleStats(draft.get(unit.id) ?? {}), armyId: warband.id, unitId: unit.id, unitName: Ledger.unitName(unit), scars: 0,
    })),
  };
}
