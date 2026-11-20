'use strict';

const battleViewTabs = { tracker: 'Battle Tracker', traits: 'Faction Traits', units: 'Units', arcana: 'Arcana' };
const battleViewIcons = { tracker: 'flag', traits: 'shield', units: 'battle', arcana: 'spell' };
let battleViewTab = 'units';
let battleViewChanged = false;
let battleViewExitHash = '';

function markBattleViewChanged() {
  battleViewChanged = true;
}

function clearBattleViewChanges() {
  battleViewChanged = false;
  battleViewExitHash = '';
}

function battleViewShouldWarn(targetHash) {
  const target = String(targetHash || '#campaigns').replace(/^#/, '');
  return battleViewChanged && !['battle-view', 'main'].includes(target);
}

function requestBattleViewExit(targetHash) {
  if (!battleViewShouldWarn(targetHash)) return false;
  battleViewExitHash = targetHash || '#campaigns';
  if (!dialog.open) viewDialog('Leave Battle View?', `<p class="copy">Battle View changed during this session. The draft is saved, but it has not been recorded in battle history.</p>
    <p class="meta">You can return later, or record the battle now to apply its results and aftermath.</p>`,
  `${button('Stay in Battle View', 'close')}${button('Leave Battle View', 'leave-battle-view', { type: 'danger' })}`);
  return true;
}

function leaveBattleView() {
  const target = battleViewExitHash || '#warbands';
  clearBattleViewChanges();
  dialog.close();
  location.hash = target;
}

function selectBattleViewTab(tab, { focus = true } = {}) {
  if (!Object.hasOwn(battleViewTabs, tab) || currentPage() !== 'battle-view') return;
  battleViewTab = tab;
  render();
  if (focus) document.querySelector(`#battle-tab-${tab}`).focus({ preventScroll: true });
}

function bindBattleViewSwipe(container) {
  let start;
  const passive = { passive: true };
  container.addEventListener('touchstart', event => {
    start = undefined;
    if (event.touches.length !== 1 || !event.target.closest('#battle-tab-panel') ||
        event.target.closest('button, input, label, select, textarea, a')) return;
    const touch = event.touches[0];
    start = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
  }, passive);
  container.addEventListener('touchcancel', () => { start = undefined; }, passive);
  container.addEventListener('touchend', event => {
    const origin = start;
    start = undefined;
    if (!origin || event.touches.length) return;
    const touch = [...event.changedTouches].find(item => item.identifier === origin.id);
    if (!touch) return;
    const dx = touch.clientX - origin.x;
    const dy = touch.clientY - origin.y;
    if (Math.abs(dx) < 55 || Math.abs(dx) < 1.5 * Math.abs(dy)) return;
    const tabs = Object.keys(battleViewTabs);
    const next = tabs[tabs.indexOf(battleViewTab) + (dx < 0 ? 1 : -1)];
    if (!next) return;
    selectBattleViewTab(next, { focus: false });
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.querySelector('#battle-tab-panel')?.animate([
      { transform: `translateX(${dx < 0 ? 28 : -28}px)`, opacity: .72 },
      { transform: 'translateX(0)', opacity: 1 },
    ], { duration: 180, easing: 'ease-out' });
  }, passive);
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
  if (battleViewTab === 'tracker') {
    cards = [];
  } else if (battleViewTab === 'traits') {
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
      ${battleViewTab === 'tracker' ? battleRoundTracker(warband) : cards.length ? `<style>${datacardStyles}</style><div class="dc-cards">${cards.join('')}</div>` : empty(emptyTitle, '')}
    </section>`;
}

function battleScore(rounds) {
  const total = key => rounds.reduce((sum, row) => sum + (row[key] ?? 0), 0);
  return `${fmt(total('warbandPoints'))} – ${fmt(total('opponentPoints'))}`;
}

function visibleBattleRounds(rounds) {
  const stop = rounds.findIndex((row, index) => Ledger.canExtendBattle(index + 1) && row.extension !== 'yes');
  return stop < 0 ? rounds : rounds.slice(0, stop + 1);
}

function battleRoundTracker(warband) {
  const rounds = Ledger.normalizeBattleRounds(warband.battleRounds);
  const visible = visibleBattleRounds(rounds);
  const pointsField = (label, key, index, value) => `<div class="field counter-field"><label for="field-${key}-${index}">${escape(label)}</label>
    <input id="field-${key}-${index}" name="${key}-${index}" value="${value ?? ''}" type="number" min="0" step="1">
    <div class="counter-adjustments" aria-label="Adjust ${escape(label)}">${[5, 1, -1, -5].map(delta =>
      `<button class="button secondary counter-step" type="button" data-action="adjust-battle-round" data-delta="${delta}" aria-label="${delta > 0 ? 'Add' : 'Subtract'} ${Math.abs(delta)} ${escape(label)}">${delta > 0 ? '+' : ''}${delta}</button>`).join('')}</div></div>`;
  return `<div class="stack battle-round-tracker">
    <section class="panel battle-tracker-summary"><div><h2>Score</h2><p class="meta">You vs Opponent</p>
      <output class="stat-value" id="battle-tracker-score" aria-live="polite">${battleScore(visible)}</output></div>
      <div class="counter-field battle-quest-counter"><label for="battle-view-quest-points">Quest Points</label>
        <input id="battle-view-quest-points" name="battleViewQuestPoints" type="number" min="0" step="1" value="${warband.battleViewQuestPoints ?? 0}" data-battle-quest-points>
        <div class="counter-adjustments" aria-label="Adjust Quest Points">${[1, -1].map(delta =>
          `<button class="button secondary counter-step" type="button" data-action="adjust-battle-quest" data-delta="${delta}" aria-label="${delta > 0 ? 'Add' : 'Subtract'} 1 Quest Point">${delta > 0 ? '+' : ''}${delta}</button>`).join('')}</div></div></section>
    <div class="battle-round-grid">${rounds.map((row, index) => `<fieldset class="panel battle-round" data-battle-round="${index}"${index >= visible.length ? ' hidden' : ''}>
      <legend>Round ${index + 1}</legend><div class="form-grid">
        <fieldset class="full initiative-options"><legend>Initiative</legend>
          <div class="actions">${Ledger.roundSides.map(([value, label]) =>
            `<label><input type="radio" name="initiative-${index}" value="${value}"${row.initiative === value ? ' checked' : ''}> ${label}</label>`).join('')}</div>
        </fieldset>
        ${pointsField('Your points', 'warbandPoints', index, row.warbandPoints)}
        ${pointsField('Opponent points', 'opponentPoints', index, row.opponentPoints)}
        ${Ledger.canExtendBattle(index + 1) ? `<div class="full">${select('Extend to next round?', `extension-${index}`, Ledger.roundExtensions, row.extension)}</div>` : ''}
        ${index === rounds.length - 1 ? '<p class="meta full">The battle ends after this round.</p>' : ''}
      </div></fieldset>`).join('')}</div>
  </div>`;
}

function updateBattleRound(input) {
  const group = input.closest('[data-battle-round]');
  if (!group || !input.validity.valid) return;
  const warband = viewedArmy();
  const rounds = Ledger.normalizeBattleRounds(warband.battleRounds);
  const index = Number(group.dataset.battleRound);
  const key = input.name.split('-')[0];
  const value = input.type === 'number' ? input.value === '' ? null : Number(input.value) : input.value;
  if (!rounds[index] || !Object.hasOwn(rounds[index], key) || rounds[index][key] === value) return;
  rounds[index][key] = value;
  warband.battleRounds = Ledger.normalizeBattleRounds(rounds);
  const visible = visibleBattleRounds(warband.battleRounds);
  document.querySelector('#battle-tracker-score').textContent = battleScore(visible);
  if (key === 'extension') {
    for (let position = index + 1; position < rounds.length; position++) {
      document.querySelector(`[data-battle-round="${position}"]`).hidden = position >= visible.length;
    }
  }
  if (!CampaignStore.save()) tell('Battle Tracker changes could not be saved in this browser.', true);
  markBattleViewChanged();
}

function updateBattleQuestPoints(input) {
  if (!input.validity.valid) return;
  const warband = viewedArmy();
  if (!warband) return;
  const value = Math.max(0, Ledger.integer(input.value));
  input.value = value;
  if ((warband.battleViewQuestPoints ?? 0) === value) return;
  warband.battleViewQuestPoints = value;
  if (!CampaignStore.save()) tell('Battle Tracker changes could not be saved in this browser.', true);
  markBattleViewChanged();
}

function adjustBattleCounter(trigger, update) {
  const field = trigger.closest('.counter-field');
  const input = field?.querySelector('input[type="number"]');
  if (!input) return;
  input.value = Math.max(0, Ledger.integer(input.value) + Ledger.integer(trigger.dataset.delta));
  update(input, true);
  input.focus({ preventScroll: true });
}

function recordedBattleRounds(rounds, first, second) {
  const rows = Ledger.normalizeBattleRounds(rounds).map((row, index) => {
    if (!row.initiative && row.warbandPoints === null && row.opponentPoints === null && !row.extension) return '';
    const initiative = row.initiative === 'warband' ? first : row.initiative === 'opponent' ? second : '—';
    const extension = Ledger.roundExtensions.find(([key]) => key === row.extension)?.[1] ?? '—';
    const format = score => score === null ? '—' : fmt(score);
    return `<tr><th scope="row">${index + 1}</th><td>${escape(initiative)}</td><td>${format(row.warbandPoints)}</td><td>${format(row.opponentPoints)}</td>
      <td>${row.extension ? extension : '—'}</td></tr>`;
  }).join('');
  return rows ? `<section><h3>Battle Tracker</h3><p class="meta">${escape(first)} ${battleScore(Ledger.normalizeBattleRounds(rounds))} ${escape(second)}</p>
    <div class="table-scroll"><table><thead><tr><th scope="col">Round</th><th scope="col">Initiative</th><th scope="col">Warband pts</th><th scope="col">Opponent pts</th><th scope="col">Extension</th></tr></thead>
    <tbody>${rows}</tbody></table></div></section>` : '';
}

function battleViewUnitCards(warband, units, battles) {
  const draft = new Map(warband.battleView.map(row => [row.id, row]));
  units.sort((a, b) => Number(Boolean(draft.get(a.id)?.dead)) - Number(Boolean(draft.get(b.id)?.dead)));
  return units.map(unit => {
    const row = draft.get(unit.id);
    const name = Ledger.unitName(unit);
    const counter = (key, label) => `<div class="counter-field"><label>${label}<input type="number" name="${key}" min="0" step="1" value="${row?.[key] ?? 0}"
      data-battle-counter data-id="${escape(unit.id)}" aria-label="${label} for ${escape(name)}"></label>
      <div class="counter-adjustments" aria-label="Adjust ${label} for ${escape(name)}">${[1, -1].map(delta =>
        `<button class="button secondary counter-step" type="button" data-action="adjust-battle-unit" data-delta="${delta}" aria-label="${delta > 0 ? 'Add' : 'Subtract'} 1 ${label} for ${escape(name)}">${delta > 0 ? '+' : ''}${delta}</button>`).join('')}</div></div>`;
    const controls = `<div class="battle-view-controls">
        ${counter('kills', 'Kills')}
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
  if (!['kills', 'dead'].includes(key)) return;
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
  markBattleViewChanged();
  if (key === 'dead') {
    render();
    [...main.querySelectorAll('[data-battle-counter][name="dead"]')].find(control => control.dataset.id === unit.id)?.focus({ preventScroll: true });
  }
}

function battleViewSeed(warband, battles) {
  const draft = new Map(warband.battleView.map(row => [row.id, row]));
  return {
    armyId: warband.id,
    questPoints: warband.battleViewQuestPoints ?? 0,
    rounds: visibleBattleRounds(Ledger.normalizeBattleRounds(warband.battleRounds)),
    awards: battleReadyUnits(warband, battles).map(unit => ({
      ...Ledger.unitBattleStats(draft.get(unit.id) ?? {}), questPoints: 0, armyId: warband.id, unitId: unit.id, unitName: Ledger.unitName(unit), scars: 0,
    })),
  };
}

window.addEventListener('beforeunload', event => {
  if (!battleViewChanged) return;
  event.preventDefault();
  event.returnValue = '';
});
