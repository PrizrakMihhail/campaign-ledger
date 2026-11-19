'use strict';

const CampaignStore = (() => {
  const key = 'ptg_campaign_ledger_v2';
  const legacyKey = 'ptg_campaign_ledger_v1';
  let data;
  let savedValue = null;
  let available = true;
  let conflict = false;
  let loadedLegacy = false;

  const read = value => value === null ? Ledger.sample() : Ledger.normalize(JSON.parse(value));

  try {
    savedValue = localStorage.getItem(key);
    const legacyValue = savedValue === null ? localStorage.getItem(legacyKey) : null;
    data = read(savedValue ?? legacyValue);
    loadedLegacy = legacyValue !== null;
  } catch {
    data = Ledger.sample();
    available = false;
  }

  function save() {
    try {
      if (localStorage.getItem(key) !== savedValue) {
        conflict = true;
        throw new Error('Campaign changed in another tab.');
      }
      const value = JSON.stringify(data);
      localStorage.setItem(key, value);
      savedValue = value;
      available = true;
      loadedLegacy = false;
    } catch {
      available = false;
    }
    return available;
  }

  return {
    get data() { return data; },
    set data(value) { data = value; },
    get available() { return available; },
    get hasSavedCampaign() { return savedValue !== null; },
    get conflict() { return conflict; },
    matchesStorageKey: changedKey => changedKey === key || changedKey === null,
    flagConflict() { conflict = true; },
    acceptExternalValue(value) {
      data = read(value);
      savedValue = value;
    },
    save,
    migrateLegacy() { if (loadedLegacy) save(); },
  };
})();
