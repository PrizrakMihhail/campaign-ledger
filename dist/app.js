'use strict';

const main = document.querySelector('#main');
const importFile = document.querySelector('#import-file');
const pages = {
  overview: ['Overview', 'overview', overview], warbands: ['Warbands', 'shield', warbands], battles: ['Battles', 'swords', battles],
  quests: ['Quests', 'flag', quests], chronicle: ['Chronicle', 'book', chronicle], settings: ['Settings', 'settings', settings],
};

function commit(message, page) {
  const saved = CampaignStore.save();
  if (page && currentPage() !== page) location.hash = page;
  else render();
  if (saved) tell(message);
  else tell(CampaignStore.conflict ? 'Another tab changed this campaign. Export your changes before reloading.' : 'Browser storage is unavailable. Export a backup to keep your changes.', true);
}

function currentPage() {
  const hash = location.hash.slice(1);
  return Object.hasOwn(pages, hash) ? hash : 'overview';
}

function render() {
  const page = currentPage();
  document.querySelector('#nav').innerHTML = Object.entries(pages).map(([key, [label, glyph]]) => `<a class="nav-link" href="#${key}"${page === key ? ' aria-current="page"' : ''}>${icon(glyph)}${label}</a>`).join('');
  document.querySelector('#topbar').innerHTML = `<div class="crumb"><span>Campaign</span><span aria-hidden="true">/</span><strong>${pages[page][0]}</strong></div>${button('Export backup', 'export', { glyph: 'download' })}`;
  const status = !CampaignStore.available ? 'Changes need a backup' : CampaignStore.data.sample && !CampaignStore.hasSavedCampaign ? 'Sample campaign' : 'Saved in this browser';
  document.querySelector('#sidebar-bottom').innerHTML = `${CampaignStore.data.sample && page !== 'overview' ? button('Start my campaign', 'start') : ''}<p class="save-info${CampaignStore.available ? '' : ' unsaved'}">${escape(status)}</p>`;
  main.innerHTML = pages[page][2]();
  document.title = `${pages[page][0]} · Path to Glory`;
}

function removeRecord(records, record, title, description, beforeRemove) {
  confirmDialog(title, description, 'Delete record', () => {
    if (beforeRemove) beforeRemove();
    records.splice(records.indexOf(record), 1);
    return ['Record deleted.'];
  });
}

function selectWarband(id, page) {
  if (!army(id)) return;
  CampaignStore.data.activeArmyId = id;
  CampaignStore.save();
  if (page && page !== currentPage()) location.hash = page;
  else render();
}

const actions = {
  start: startCampaign,
  export: exportBackup,
  'export-datacards': exportDatacards,
  'view-datacards': () => viewWarbandDatacards(activeArmy()),
  'view-unit-datacard': id => {
    const warband = activeArmy();
    const unit = warband?.units.find(item => item.id === id);
    if (unit) viewWarbandDatacards(warband, unit);
  },
  'profile-library': () => viewProfileLibrary(true),
  'back-to-profile-library': () => viewProfileLibrary(),
  'view-catalogue-datacard': viewCatalogueDatacard,
  import: () => importFile.click(),
  print: () => {
    if (currentPage() === 'overview') window.print();
    else {
      window.addEventListener('hashchange', () => window.print(), { once: true });
      location.hash = 'overview';
    }
  },
  close: () => dialog.close(),
  'new-warband': () => warbandForm(),
  'edit-warband': () => warbandForm(activeArmy()),
  'archive-warband': () => {
    const a = activeArmy();
    a.archived = !a.archived;
    if (a.archived) CampaignStore.data.activeArmyId = CampaignStore.data.armies.find(other => !other.archived)?.id || a.id;
    commit(a.archived ? 'Warband archived.' : 'Warband restored.');
  },
  'select-warband': id => selectWarband(id),
  'go-warband': id => selectWarband(id, 'warbands'),
  'quest-warband': id => selectWarband(id, 'quests'),
  'new-unit': () => unitForm(activeArmy()),
  'edit-unit': id => unitForm(activeArmy(), activeArmy().units.find(u => u.id === id)),
  'unit-history': id => unitHistory(activeArmy(), activeArmy().units.find(u => u.id === id)),
  'remove-unit': id => {
    const a = activeArmy();
    const u = a.units.find(unit => unit.id === id);
    removeRecord(a.units, u, `Remove ${u.name}?`, 'The unit will be removed from the roster. Its Renown awards will remain in the battle history.', () => {
      for (const battle of CampaignStore.data.battles) {
        for (const award of battle.awards) if (award.armyId === a.id && award.unitId === id) award.unitName = u.name;
      }
    });
  },
  'new-resource': () => resourceForm(activeArmy()),
  'edit-resource': id => resourceForm(activeArmy(), activeArmy().ledger.find(item => item.id === id)),
  'remove-resource': id => {
    const list = activeArmy().ledger;
    removeRecord(list, list.find(item => item.id === id), 'Delete adjustment?', 'The warband’s balance will be recalculated.');
  },
  'new-battle': () => battleForm(),
  'edit-battle': id => battleForm(CampaignStore.data.battles.find(b => b.id === id)),
  'view-battle': id => viewBattle(CampaignStore.data.battles.find(b => b.id === id)),
  'remove-battle': id => removeRecord(CampaignStore.data.battles, CampaignStore.data.battles.find(b => b.id === id), 'Delete battle?', 'This removes the result and its linked resource changes and Renown awards.'),
  'new-quest': () => questForm(activeArmy()),
  'edit-quest': id => questForm(activeArmy(), activeArmy().quests.find(q => q.id === id)),
  'complete-quest': id => {
    const q = activeArmy().quests.find(item => item.id === id);
    q.status = 'Completed';
    if (q.target) q.progress = q.target;
    commit('Quest completed.');
  },
  'remove-quest': id => {
    const list = activeArmy().quests;
    removeRecord(list, list.find(q => q.id === id), 'Delete quest?', 'This removes the quest, its progress, and reward notes.');
  },
  'new-entry': () => entryForm(),
  'edit-entry': id => entryForm(CampaignStore.data.entries.find(e => e.id === id)),
  'remove-entry': id => removeRecord(CampaignStore.data.entries, CampaignStore.data.entries.find(e => e.id === id), 'Delete chronicle entry?', 'This removes this entry from the campaign chronicle.'),
};

document.addEventListener('click', event => {
  const trigger = event.target.closest('[data-action]');
  if (trigger) actions[trigger.dataset.action]?.(trigger.dataset.id);
  if (event.target === dialog) {
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  }
  if (event.target.closest('.skip-link')) {
    event.preventDefault();
    main.focus();
    main.scrollIntoView();
  }
});

document.addEventListener('submit', event => {
  const form = event.target;
  if (form.id !== 'editor-form' && form.id !== 'settings-form') return;
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  try {
    if (form.id === 'settings-form') {
      CampaignStore.data.campaign = campaignValues(values);
      commit('Campaign details saved.');
    } else {
      const submit = dialogEditor();
      if (!submit) return;
      const [message, page] = submit(values, form);
      dialog.close();
      commit(message, page);
    }
  } catch (error) {
    const message = form.querySelector('.form-error');
    if (!message) tell(error.message, true);
    else {
      message.hidden = false;
      message.textContent = error.message;
      message.scrollIntoView({ block: 'nearest' });
    }
  }
});

main.addEventListener('input', event => {
  if (event.target.name === 'query') updateFilters(event);
});

document.addEventListener('change', event => {
  const input = event.target;
  if (input.closest('#battle-filters') && input.name !== 'query') updateFilters(event);
  if (input.name === 'quest-warband') selectWarband(input.value);
  if (input.name === 'pack' && input.form) {
    const resource = input.form.elements.resource;
    if (!resource.value.trim() || [...Ledger.packs.values()].includes(resource.value)) resource.value = Ledger.packs.get(input.value) || Ledger.packs.get('Custom');
  }
});

importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  importFile.value = '';
  if (!file) return;
  try {
    const incoming = Ledger.normalize(JSON.parse(await file.text()));
    confirmDialog(`Import ${incoming.campaign.name}?`, `This backup has ${incoming.armies.length} warbands and ${incoming.battles.length} battles. Importing replaces the current campaign in this browser.`, 'Import campaign', () => {
      CampaignStore.data = incoming;
      resetBattleFilters();
      return ['Campaign imported.', 'overview'];
    });
  } catch (error) {
    tell(`Backup could not be imported. ${error.message}`, true);
  }
});

window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
});

window.addEventListener('storage', event => {
  if (!CampaignStore.matchesStorageKey(event.key)) return;
  if (dialog.open || !CampaignStore.available || document.activeElement?.closest('#settings-form')) {
    CampaignStore.flagConflict();
    tell('This campaign changed in another tab. Export any unsaved work before reloading.', true);
    return;
  }
  try {
    CampaignStore.acceptExternalValue(event.newValue);
    resetBattleFilters();
    render();
  } catch {
    CampaignStore.flagConflict();
    tell('The campaign in another tab could not be loaded.', true);
  }
});

document.querySelector('#brand-mark').innerHTML = icon('shield');
CampaignStore.migrateLegacy();
render();
