'use strict';

const battleViewTabs = { traits: 'Faction Traits', units: 'Units', arcana: 'Arcana' };
const battleViewIcons = { traits: 'shield', units: 'battle', arcana: 'spell' };
let battleViewTab = 'units';

function selectBattleViewTab(tab) {
  if (!Object.hasOwn(battleViewTabs, tab) || currentPage() !== 'battle-view') return;
  battleViewTab = tab;
  render();
  document.querySelector(`#battle-tab-${tab}`).focus({ preventScroll: true });
}

function navigateBattleViewTabs(event) {
  const target = event.target.closest('[data-action="battle-view-tab"]');
  if (!target) return;
  const tabs = Object.keys(battleViewTabs);
  const position = tabs.indexOf(target.dataset.id);
  const next = { Home: 0, End: tabs.length - 1, ArrowLeft: (position + tabs.length - 1) % tabs.length, ArrowRight: (position + 1) % tabs.length };
  if (!Object.hasOwn(next, event.key)) return;
  event.preventDefault();
  selectBattleViewTab(tabs[next[event.key]]);
}

function battleView() {
  const warband = viewedArmy();
  const back = pageLink('Warbands', 'warbands');
  const title = heading('Battle View', warband?.name, back +
    (warband && !warband.archived ? button('Record the battle', 'record-battle-view', { type: 'primary', glyph: 'battle' }) : ''));
  if (!warband || warband.archived) return title + empty('No playable warband selected', 'Select an unarchived warband.');

  const battles = CampaignStore.data.battles;
  const tabs = Object.entries(battleViewTabs).map(([id, label]) => {
    const selected = id === battleViewTab;
    return `<button class="button secondary" type="button" role="tab" id="battle-tab-${id}" data-action="battle-view-tab" data-id="${id}" aria-selected="${selected}" aria-controls="battle-tab-panel" tabindex="${selected ? 0 : -1}">${icon(battleViewIcons[id])}${label}</button>`;
  }).join('');
  let cards;
  let emptyTitle;
  if (battleViewTab === 'traits') {
    cards = factionTraitCards(warband);
    emptyTitle = 'No faction traits added';
  } else {
    const arcana = battleViewTab === 'arcana';
    const units = battleReadyUnits(warband, battles).filter(unit => (unitRosterType(warband, unit) === 'Manifestation') === arcana);
    cards = arcana ? [...arcanaActionCards(warband), ...battleViewUnitCards(warband, units, battles)] : battleViewUnitCards(warband, units, battles);
    emptyTitle = arcana ? 'No arcana added' : 'No battle-ready units';
  }
  return title + `<div class="battle-view-tabs" role="tablist" aria-label="Battle View">${tabs}</div>
    <section id="battle-tab-panel" role="tabpanel" aria-labelledby="battle-tab-${battleViewTab}" tabindex="0">
      ${cards.length ? `<style>${datacardStyles}</style><div class="dc-cards">${cards.join('')}</div>` : empty(emptyTitle, '')}
    </section>`;
}

function battleViewUnitCards(warband, units, battles) {
  const draft = new Map(warband.battleView.map(row => [row.id, row]));
  units.sort((a, b) => Number(Boolean(draft.get(a.id)?.dead)) - Number(Boolean(draft.get(b.id)?.dead)));
  return units.map(unit => {
    const row = draft.get(unit.id);
    const name = Ledger.unitName(unit);
    const counter = (key, label) => `<label>${label}<input type="number" name="${key}" min="0" step="1" value="${row?.[key] ?? 0}"
      data-battle-counter data-id="${escape(unit.id)}" aria-label="${label} for ${escape(name)}"></label>`;
    const controls = `<div class="battle-view-controls">
        ${counter('kills', 'Kills')}${counter('questPoints', 'Quest Points')}
        <label class="battle-view-dead"><input type="checkbox" name="dead" data-battle-counter data-id="${escape(unit.id)}"
          aria-label="Mark ${escape(name)} dead"${row?.dead ? ' checked' : ''}> Dead</label>
      </div>`;
    return `<section class="battle-view-unit${row?.dead ? ' is-dead' : ''}">
      ${unitDatacard(warband, unit, battles, { controls })}
    </section>`;
  });
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
