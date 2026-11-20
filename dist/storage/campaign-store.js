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
    const entries = records.map(({ id, data, revision, updatedAt, dirty, ownerId }) => {
      if (typeof id !== 'string' || !uuidV4.test(id)) {
        const replacement = Ledger.id();
        if (id === previousId) selection = replacement;
        id = replacement;
        migrated = true;
      }
      return {
        id,
        data: Ledger.normalize(data),
        revision: Number.isSafeInteger(revision) && revision > 0 ? revision : null,
        updatedAt: typeof updatedAt === 'string' ? updatedAt : '',
        dirty: dirty !== false,
        ownerId: typeof ownerId === 'string' ? ownerId : '',
      };
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

  function save(markDirty = true) {
    if (markDirty) {
      const selected = campaigns.find(entry => entry.id === selectedId);
      if (selected) selected.dirty = true;
    }
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
    if (available && markDirty && typeof CampaignCloud !== 'undefined') CampaignCloud.queueSave(selectedId);
    return available;
  }

  return {
    get data() {
      const ownerId = typeof Account !== 'undefined' ? Account.user?.id ?? '' : '';
      const entry = campaigns.find(item => item.id === selectedId);
      return entry && (!ownerId || !entry.ownerId || entry.ownerId === ownerId) ? entry.data : null;
    },
    get campaigns() {
      const ownerId = typeof Account !== 'undefined' ? Account.user?.id ?? '' : '';
      return ownerId ? campaigns.filter(entry => !entry.ownerId || entry.ownerId === ownerId) : campaigns;
    },
    get allCampaigns() { return campaigns; },
    select,
    add(data) {
      const id = Ledger.id();
      const ownerId = typeof Account !== 'undefined' ? Account.user?.id ?? '' : '';
      campaigns.push({ id, data, revision: null, updatedAt: '', dirty: true, ownerId });
      select(id);
    },
    remove(id) {
      const index = campaigns.findIndex(entry => entry.id === id);
      if (index < 0) return false;
      campaigns.splice(index, 1);
      if (selectedId === id) {
        const ownerId = typeof Account !== 'undefined' ? Account.user?.id ?? '' : '';
        const fallback = campaigns.find(entry => !ownerId || !entry.ownerId || entry.ownerId === ownerId);
        selectedId = '';
        if (fallback) select(fallback.id);
        else try { sessionStorage.setItem(selectionKey, ''); } catch { /* No selection needs to be remembered. */ }
      }
      return save(false);
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
    migrate() { if (needsMigration) save(false); },
  };
})();
