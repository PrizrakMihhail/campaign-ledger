'use strict';

const CampaignStore = (() => {
  const key = 'ptg_campaign_ledger_v2';
  const legacyKey = 'ptg_campaign_ledger_v1';
  const selectionKey = 'ptg_selected_campaign';
  let campaigns = [];
  let selectedId = '';
  let savedValue = null;
  let available = true;
  let conflict = false;
  let needsMigration = false;
  const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function read(value, previousId) {
    if (value === null) return { entries: [], selection: previousId, migrated: false };
    const parsed = JSON.parse(value);
    const records = Array.isArray(parsed?.campaigns) ? parsed.campaigns : [{ data: parsed }];
    let selection = previousId;
    let migrated = false;
    const entries = records.map(({ id, data }) => {
      if (typeof id !== 'string' || !uuidV4.test(id)) {
        const replacement = Ledger.id();
        if (id === previousId) selection = replacement;
        id = replacement;
        migrated = true;
      }
      return { id, data: Ledger.normalize(data) };
    });
    return { entries, selection, migrated };
  }

  function select(id) {
    if (!campaigns.some(entry => entry.id === id)) return false;
    selectedId = id;
    try { sessionStorage.setItem(selectionKey, id); } catch { /* The current tab can still switch campaigns. */ }
    return true;
  }

  let rememberedId;
  try { rememberedId = sessionStorage.getItem(selectionKey); } catch { /* Fall back to the first campaign. */ }

  try {
    savedValue = localStorage.getItem(key);
    const legacyValue = savedValue === null ? localStorage.getItem(legacyKey) : null;
    const { entries, selection, migrated } = read(savedValue ?? legacyValue, rememberedId);
    campaigns = entries;
    needsMigration = migrated || legacyValue !== null;
    select(selection) || select(campaigns[0]?.id);
  } catch {
    available = false;
  }

  function save() {
    try {
      if (localStorage.getItem(key) !== savedValue) {
        conflict = true;
        throw new Error('Campaign changed in another tab.');
      }
      const value = JSON.stringify({ campaigns });
      localStorage.setItem(key, value);
      savedValue = value;
      available = true;
      conflict = false;
      needsMigration = false;
    } catch {
      available = false;
    }
    return available;
  }

  return {
    get data() { return campaigns.find(entry => entry.id === selectedId)?.data ?? null; },
    get campaigns() { return campaigns; },
    select,
    add(data) {
      const id = Ledger.id();
      campaigns.push({ id, data });
      select(id);
    },
    get available() { return available; },
    get conflict() { return conflict; },
    matchesStorageKey: changedKey => changedKey === key || changedKey === null,
    flagConflict() { conflict = true; },
    acceptExternalValue(value) {
      const { entries, selection, migrated } = read(value, selectedId);
      campaigns = entries;
      savedValue = value;
      conflict = false;
      needsMigration = migrated;
      if (selection !== selectedId) select(selection);
    },
    save,
    migrate() { if (needsMigration) save(); },
  };
})();
