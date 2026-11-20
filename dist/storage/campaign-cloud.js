'use strict';

const CampaignCloud = (() => {
  let userId = '';
  let state = 'local';
  let error = '';
  let timer = null;
  let notify = () => {};
  let operation = Promise.resolve();
  let conflicts = [];

  const serialized = value => JSON.stringify(value);
  const cloudEntry = row => ({
    id: row.id,
    data: Ledger.normalize(row.campaign_data),
    revision: row.revision,
    updatedAt: row.updated_at,
    dirty: false,
    ownerId: userId,
  });

  function announce(nextState, nextError = '') {
    state = nextState;
    error = nextError;
    queueMicrotask(notify);
  }

  function initialize(onChange) {
    notify = onChange ?? notify;
  }

  function setAccount(user) {
    const nextId = user?.id ?? '';
    if (nextId === userId) return;
    userId = nextId;
    conflicts = [];
    if (timer) clearTimeout(timer);
    timer = null;
    if (!userId) {
      announce('local');
      return;
    }
    operation = operation.then(loadAndMerge).catch(syncError);
  }

  function applyCloud(local, row) {
    Object.assign(local, cloudEntry(row));
  }

  function addConflict(local, row) {
    const existing = conflicts.find(conflict => conflict.id === local.id);
    if (existing) existing.row = row;
    else conflicts.push({ id: local.id, local, row });
  }

  async function loadAndMerge() {
    if (!userId || !Account.client) return;
    announce('syncing');
    const { data: rows, error: loadError } = await Account.client
      .from('player_campaigns')
      .select('id, campaign_data, revision, updated_at')
      .order('updated_at', { ascending: true });
    if (loadError) throw loadError;

    const remote = new Map((rows ?? []).map(row => [row.id, row]));
    const uploads = [];
    const localEntries = CampaignStore.allCampaigns;
    for (const local of localEntries.filter(entry => !entry.ownerId || entry.ownerId === userId)) {
      const row = remote.get(local.id);
      if (!row) {
        uploads.push(local);
        continue;
      }
      remote.delete(local.id);
      if (serialized(local.data) === serialized(row.campaign_data)) {
        applyCloud(local, row);
      } else if (local.revision === null || (local.dirty && local.revision !== row.revision)) {
        addConflict(local, row);
      } else if (local.dirty && local.revision === row.revision) {
        uploads.push(local);
      } else {
        applyCloud(local, row);
      }
    }
    for (const row of remote.values()) localEntries.push(cloudEntry(row));
    if (!CampaignStore.save(false)) throw new Error('Cloud campaigns loaded, but browser storage could not be updated.');
    for (const entry of uploads) {
      if (!await saveEntry(entry)) break;
    }
    if (conflicts.length) {
      announce('conflict', 'Local and cloud changes need your decision.');
      showConflict();
    } else {
      announce('synced');
    }
  }

  async function currentCloudRow(id) {
    const { data, error: loadError } = await Account.client.from('player_campaigns')
      .select('id, campaign_data, revision, updated_at')
      .eq('id', id)
      .maybeSingle();
    if (loadError) throw loadError;
    return data;
  }

  async function saveEntry(entry) {
    if (!userId || !Account.client || !entry?.dirty) return true;
    if (entry.ownerId && entry.ownerId !== userId) return true;
    entry.ownerId = userId;
    const payload = serialized(entry.data);
    let result;
    if (entry.revision === null) {
      result = await Account.client.from('player_campaigns').insert({
        id: entry.id,
        user_id: userId,
        campaign_data: entry.data,
      }).select('id, revision, updated_at').single();
    } else {
      result = await Account.client.from('player_campaigns')
        .update({ campaign_data: entry.data })
        .eq('id', entry.id)
        .eq('revision', entry.revision)
        .select('id, revision, updated_at')
        .maybeSingle();
    }
    if (result.error) throw result.error;
    if (!result.data) {
      const row = await currentCloudRow(entry.id);
      if (!row) throw new Error('The cloud campaign was deleted on another device.');
      addConflict(entry, row);
      announce('conflict', 'Local and cloud changes need your decision.');
      showConflict();
      return false;
    }
    entry.revision = result.data.revision;
    entry.updatedAt = result.data.updated_at;
    entry.dirty = serialized(entry.data) !== payload;
    if (!CampaignStore.save(false)) throw new Error('Campaign reached the cloud, but its local sync state could not be saved.');
    if (entry.dirty) queueSave(entry.id);
    return true;
  }

  function queueSave(id) {
    if (!userId || !Account.client || !id || conflicts.some(conflict => conflict.id === id)) return;
    announce('pending');
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      operation = operation.then(async () => {
        const entry = CampaignStore.allCampaigns.find(item => item.id === id);
        if (!entry?.dirty) return;
        announce('syncing');
        if (await saveEntry(entry) && !conflicts.length) announce('synced');
      }).catch(syncError);
    }, 600);
  }

  function showConflict() {
    const conflict = conflicts[0];
    if (!conflict || typeof viewDialog === 'undefined' || dialog.open) return;
    const localName = conflict.local.data.campaign.name;
    const cloudName = conflict.row.campaign_data?.campaign?.name || localName;
    const cloudTime = conflict.row.updated_at ? new Date(conflict.row.updated_at).toLocaleString() : 'Unknown';
    viewDialog('Campaign sync conflict', `<p class="copy">This campaign changed both locally and in the cloud. Choose which complete version to keep.</p>
      <div class="conflict-versions"><div class="card"><p class="label">Local version</p><h3>${escape(localName)}</h3><p class="meta">Contains the changes currently saved in this browser.</p></div>
      <div class="card"><p class="label">Cloud version</p><h3>${escape(cloudName)}</h3><p class="meta">Last cloud update: ${escape(cloudTime)}</p></div></div>
      <p class="meta">This choice replaces the other version. Export a backup first if you need to preserve both.</p>`,
    `${button('Use cloud version', 'resolve-cloud')}${button('Use local version', 'resolve-local', { type: 'danger' })}`);
  }

  function resolve(choice) {
    operation = operation.then(async () => {
      const conflict = conflicts[0];
      if (!conflict) return;
      if (choice === 'cloud') {
        applyCloud(conflict.local, conflict.row);
        if (!CampaignStore.save(false)) throw new Error('The cloud version could not be saved in this browser.');
      } else {
        const latest = await currentCloudRow(conflict.id);
        if (!latest) throw new Error('The cloud campaign was deleted before the conflict was resolved.');
        conflict.row = latest;
        conflict.local.revision = latest.revision;
        conflict.local.updatedAt = latest.updated_at;
        conflict.local.dirty = true;
        if (!await saveEntry(conflict.local)) return;
      }
      conflicts.shift();
      if (conflicts.length) {
        announce('conflict', 'Another campaign conflict needs your decision.');
        showConflict();
      } else {
        announce('synced');
      }
    }).catch(syncError);
  }

  function syncError(reason) {
    announce('error', reason?.message || 'Cloud synchronization failed.');
  }

  return {
    get state() { return state; },
    get error() { return error; },
    get conflictCount() { return conflicts.length; },
    get label() {
      return state === 'synced' ? 'Cloud synced' : state === 'syncing' ? 'Syncing…' :
        state === 'pending' ? 'Cloud save pending' : state === 'conflict' ? 'Cloud conflict' :
        state === 'error' ? 'Cloud sync error' : 'Saved in this browser';
    },
    initialize,
    setAccount,
    queueSave,
    showConflict,
    useCloud() { resolve('cloud'); },
    useLocal() { resolve('local'); },
  };
})();
