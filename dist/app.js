'use strict';

const main = document.querySelector('#main');
const importFile = document.querySelector('#import-file');
const menuToggle = document.querySelector('#menu-toggle');
const pages = {
  overview: ['Overview', 'overview', overview], warbands: ['Warbands', 'shield', warbands], battles: ['Battles', 'battle', battles],
  'arcane-tome': ['Arcane Tome', 'spell', arcaneTome],
  'battle-view': ['Battle View', null, battleView],
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
  if (!CampaignStore.data) return 'start';
  const hash = location.hash.slice(1);
  return Object.hasOwn(pages, hash) ? hash : 'overview';
}

function render() {
  const page = currentPage();
  const shell = document.querySelector('.shell');
  shell.classList.toggle('setup-shell', page === 'start');
  shell.classList.toggle('battle-view-shell', page === 'battle-view');
  if (page === 'start') {
    main.innerHTML = setupCampaign();
    document.title = 'Start the campaign · Path to Glory';
    return;
  }
  const navPage = page === 'battle-view' ? 'warbands' : page;
  document.querySelector('#nav').innerHTML = Object.entries(pages).filter(([, [, glyph]]) => glyph)
    .map(([key, [label, glyph]]) => `<a class="nav-link" href="#${key}"${navPage === key ? ' aria-current="page"' : ''}>${icon(glyph)}${label}</a>`).join('') +
    button('Export backup', 'export', { type: 'secondary mobile-menu-backup', glyph: 'download' });
  const selected = viewedArmy();
  const options = armyOptions().map(([id, label]) => [id, id === CampaignStore.data.activeWarbandId ? `${label} (Active)` : label]);
  if (!activeArmy()) options.unshift(['', 'Choose a warband']);
  const picker = CampaignStore.data.armies.length ? select('Warband', 'view-warband', options, selected?.id ?? '') : '';
  document.querySelector('#topbar').innerHTML = `<div class="crumb"><span>Campaign</span><span aria-hidden="true">/</span><strong>${pages[page][0]}</strong></div>
    <div class="topbar-controls">${picker}${button('Export backup', 'export', { glyph: 'download' })}</div>`;
  const status = CampaignStore.available ? 'Saved in this browser' : 'Changes need a backup';
  document.querySelector('#sidebar-bottom').innerHTML = `<p class="save-info${CampaignStore.available ? '' : ' unsaved'}">${escape(status)}</p>`;
  main.innerHTML = pages[page][2]();
  document.title = `${pages[page][0]} · Path to Glory`;
}

function removeRecord(records, record, title, description, beforeRemove) {
  confirmDialog(title, description, 'Delete record', () => {
    const index = records.indexOf(record);
    if (index < 0) return ['Record is already gone.'];
    if (beforeRemove) beforeRemove();
    records.splice(index, 1);
    return ['Record deleted.'];
  });
}

function selectWarband(id) {
  if (id && !army(id)) return;
  viewedArmyId = id === CampaignStore.data.activeWarbandId ? '' : id;
  render();
}

function setMobileMenu(open) {
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
}

const mobileMenuOpen = () => menuToggle.getAttribute('aria-expanded') === 'true';
menuToggle.addEventListener('click', () => setMobileMenu(!mobileMenuOpen()));

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || dialog.open || !mobileMenuOpen()) return;
  event.preventDefault();
  setMobileMenu(false);
  menuToggle.focus();
});

const actions = {
  ...arcaneTomeActions,
  start: startCampaign,
  export: exportBackup,
  'export-datacards': exportDatacards,
  'view-datacards': () => viewWarbandDatacards(viewedArmy()),
  'view-unit-datacard': id => {
    const warband = viewedArmy();
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
  close: requestDialogClose,
  'new-warband': () => warbandForm(),
  'edit-warband': () => warbandForm(viewedArmy()),
  'remove-warband': () => removeWarband(viewedArmy()),
  'import-warband-rules': () => warbandImportForm(viewedArmy()),
  'import-trait-list': () => traitListImportForm(viewedArmy()),
  'make-active-warband': () => {
    const a = viewedArmy();
    if (!a || a.archived) return;
    CampaignStore.data.activeWarbandId = a.id;
    viewedArmyId = '';
    commit(`${a.name} is now the Active warband.`);
  },
  'archive-warband': () => {
    const a = viewedArmy();
    a.archived = !a.archived;
    if (a.archived && a.id === CampaignStore.data.activeWarbandId) {
      CampaignStore.data.activeWarbandId = Ledger.latestWarband(CampaignStore.data.armies)?.id ?? '';
      viewedArmyId = CampaignStore.data.activeWarbandId ? '' : a.id;
    }
    if (!a.archived && !activeArmy()) {
      CampaignStore.data.activeWarbandId = a.id;
      viewedArmyId = '';
    }
    commit(a.archived ? 'Warband archived.' : 'Warband restored.');
  },
  'new-unit': () => unitForm(viewedArmy()),
  'new-battle-trait': () => battleTraitForm(viewedArmy()),
  'edit-battle-trait': id => {
    const a = viewedArmy();
    const trait = a.battleTraits.find(item => item.id === id);
    if (trait) battleTraitForm(a, trait);
  },
  'remove-battle-trait': id => {
    const traits = viewedArmy().battleTraits;
    removeRecord(traits, traits.find(trait => trait.id === id), 'Delete battle trait?', 'This removes the trait from the warband and its datacard export.');
  },
  'record-battle-view': () => {
    const a = viewedArmy();
    if (a && !a.archived) battleForm(undefined, battleViewSeed(a, CampaignStore.data.battles));
  },
  'battle-view-tab': selectBattleViewTab,
  'new-anvil-hero': () => unitForm(viewedArmy(), undefined, { anvilHero: true }),
  'edit-unit': id => unitForm(viewedArmy(), viewedArmy().units.find(u => u.id === id)),
  'unit-history': id => unitHistory(viewedArmy(), viewedArmy().units.find(u => u.id === id)),
  'remove-unit': id => {
    const a = viewedArmy();
    const u = a.units.find(unit => unit.id === id);
    if (!u) return;
    removeRecord(a.units, u, `Remove ${u.name}?`, 'The unit will be removed from the roster. Its Renown and Battle Scars will remain in the battle history.', () => {
      if (a.warlordId === id) a.warlordId = '';
      a.battleView = a.battleView.filter(row => row.id !== id);
      for (const battle of CampaignStore.data.battles) {
        for (const award of battle.awards) if (award.armyId === a.id && award.unitId === id) award.unitName = u.name;
      }
    });
  },
  'new-resource': kind => resourceForm(viewedArmy(), undefined, kind),
  'edit-resource': id => resourceForm(viewedArmy(), viewedArmy().ledger.find(item => item.id === id)),
  'remove-resource': id => {
    const list = viewedArmy().ledger;
    removeRecord(list, list.find(item => item.id === id), 'Delete adjustment?', 'The warband’s balance will be recalculated.');
  },
  'new-battle': () => battleForm(),
  'edit-battle': id => battleForm(CampaignStore.data.battles.find(b => b.id === id)),
  'view-battle': id => viewBattle(CampaignStore.data.battles.find(b => b.id === id)),
  'remove-battle': id => removeRecord(CampaignStore.data.battles, CampaignStore.data.battles.find(b => b.id === id), 'Delete battle?', 'This removes the result and its linked resource changes, Renown awards, and Battle Scars.'),
  'new-quest': () => questForm(viewedArmy()),
  'edit-quest': id => questForm(viewedArmy(), viewedArmy().quests.find(q => q.id === id)),
  'complete-quest': id => {
    const a = viewedArmy();
    const q = Ledger.activeQuest(a);
    if (!q || q.id !== id) return;
    q.status = 'Completed';
    if (q.target) q.progress = Math.max(q.progress, q.target - Ledger.questBattlePoints(CampaignStore.data.battles, a.id, q.id));
    commit('Quest completed.');
  },
  'forfeit-quest': id => {
    const a = viewedArmy();
    const quest = Ledger.activeQuest(a);
    if (!quest || quest.id !== id) return;
    confirmDialog(`Forfeit ${quest.title}?`, 'Progress stays in your quest history and you can start another quest.', 'Forfeit', () => {
      quest.status = 'Forfeited';
      return ['Quest forfeited.', 'quests'];
    });
  },
  'remove-quest': id => {
    const list = viewedArmy().quests;
    removeRecord(list, list.find(q => q.id === id), 'Delete quest?', 'This removes the quest, its progress, and reward notes.');
  },
  'new-entry': () => entryForm(),
  'edit-entry': id => entryForm(CampaignStore.data.entries.find(e => e.id === id)),
  'remove-entry': id => removeRecord(CampaignStore.data.entries, CampaignStore.data.entries.find(e => e.id === id), 'Delete chronicle entry?', 'This removes this entry from the campaign chronicle.'),
};

document.addEventListener('click', event => {
  const navItem = event.target.closest('#nav a, #nav button, .brand');
  if (mobileMenuOpen() && (navItem || !event.target.closest('.sidebar'))) {
    setMobileMenu(false);
    if (navItem) menuToggle.focus();
  }
  const trigger = event.target.closest('[data-action]');
  if (trigger) actions[trigger.dataset.action]?.(trigger.dataset.id);
  if (event.target === dialog) {
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) requestDialogClose();
  }
  if (event.target.closest('.skip-link')) {
    event.preventDefault();
    main.focus();
    main.scrollIntoView();
  }
});

document.addEventListener('submit', event => {
  const form = event.target;
  if (!['editor-form', 'settings-form', 'start-form'].includes(form.id)) return;
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  try {
    if (form.id === 'start-form') {
      if (!CampaignStore.data) commit(...createCampaign(values));
    } else if (form.id === 'settings-form') {
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

main.addEventListener('keydown', navigateBattleViewTabs);
bindBattleViewSwipe(main);
main.addEventListener('input', event => {
  const input = event.target;
  if (input.name === 'query') updateFilters(event);
  if (input.type === 'number' && input.hasAttribute('data-battle-counter')) updateBattleView(input);
});

document.addEventListener('change', event => {
  const input = event.target;
  if (input.hasAttribute('data-battle-counter')) updateBattleView(input, true);
  if (input.closest('#battle-filters') && input.name !== 'query') updateFilters(event);
  if (input.id === 'field-view-warband') {
    selectWarband(input.value);
    document.querySelector('#field-view-warband')?.focus();
  }
  if (input.name === 'pack' && input.form) {
    const resource = input.form.elements.resource;
    if (!resource.value.trim() || [...Ledger.packs.values()].includes(resource.value)) resource.value = Ledger.packs.get(input.value) ?? '';
  }
});

importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  importFile.value = '';
  if (!file) return;
  try {
    const incoming = Ledger.normalize(JSON.parse(await file.text()));
    const summary = `This backup has ${incoming.armies.length} warbands and ${incoming.battles.length} battles.`;
    confirmDialog(`Import ${incoming.campaign.name}?`, CampaignStore.data ? `${summary} Importing replaces the current campaign in this browser.` : summary, 'Import campaign', () => {
      CampaignStore.data = incoming;
      viewedArmyId = '';
      resetBattleFilters();
      return ['Campaign imported.', 'overview'];
    });
  } catch (error) {
    tell(`Backup could not be imported. ${error.message}`, true);
  }
});

window.addEventListener('hashchange', () => {
  if (mobileMenuOpen()) setMobileMenu(false);
  render();
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
});

window.addEventListener('storage', event => {
  if (!CampaignStore.matchesStorageKey(event.key)) return;
  if (dialog.open || !CampaignStore.available || document.activeElement?.closest('#settings-form, #start-form')) {
    CampaignStore.flagConflict();
    tell('This campaign changed in another tab. Export any unsaved work before reloading.', true);
    return;
  }
  try {
    CampaignStore.acceptExternalValue(event.newValue);
    if (!CampaignStore.data) viewedArmyId = '';
    resetBattleFilters();
    render();
  } catch {
    CampaignStore.flagConflict();
    tell('The campaign in another tab could not be loaded.', true);
  }
});

document.querySelector('#brand-mark').innerHTML = icon('shield');
menuToggle.innerHTML = icon('menu') + icon('close');
setMobileMenu(false);
CampaignStore.migrateLegacy();
render();
