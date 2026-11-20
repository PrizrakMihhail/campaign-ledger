import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext, runInContext } from 'node:vm';

const site = new URL('../dist/', import.meta.url);
const html = await readFile(new URL('index.html', site), 'utf8');
const entries = [...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)].map(match => match[1]);
const asset = (path, base = site) => {
  const url = new URL(path, base);
  assert.ok(url.href.startsWith(site.href), `Asset must be inside dist: ${path}`);
  return url;
};
assert.equal(entries.at(-1), 'app.js', 'App must start after its dependencies');
assert.equal(entries.length, new Set(entries).size, 'Each script should load only once');
assert.ok(entries.includes('config.js'), 'Public Supabase configuration must load before the app');
assert.ok(entries.includes('storage/account.js'), 'Account support must load before the app');
assert.ok(entries.includes('storage/campaign-cloud.js'), 'Cloud campaign sync must load before the app');
const cloudSource = await readFile(new URL('storage/campaign-cloud.js', site), 'utf8');
assert.match(cloudSource, /function resolve\(choice\)/, 'Cloud conflicts must have a resolution handler');
assert.match(cloudSource, /Use cloud version[\s\S]*Use local version/,
  'Cloud conflicts must require an explicit local-or-cloud choice');
assert.ok(entries.includes('data/wahapedia-catalogue-data.js'), 'Deployment catalogue must load before the app');
const scripts = await Promise.all(entries.map(async path => new Script(await readFile(asset(path), 'utf8'), { filename: path })));
for (const [, stylesheet] of html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)) {
  const url = asset(stylesheet);
  const css = await readFile(url, 'utf8');
  for (const [, path] of css.matchAll(/url\(['"]([^'"]+)['"]\)/g)) await readFile(asset(path, url));
}

const key = 'ptg_campaign_ledger_v2';
const fixture = {
  version: 3, activeWarbandId: 'forge',
  campaign: {
    name: 'Verification Campaign', pack: 'Ascension', location: 'The Ashen Marches', resource: '', pointsLimit: 1000,
    notes: 'Two rival warbands follow the old beacon road into the Ashen Marches. Whoever lights the final beacon will command the crossing.',
  },
  armies: [
    {
      id: 'forge', name: 'Forge of the Sunset', faction: 'Khazalite Holds', warlord: 'Dagna Emberhand', color: '#ca935d',
      notes: 'Dagna and her company seek the last surviving beacon of their ancestral hold.',
      units: [
        { id: 'dagna', name: 'Dagna Emberhand', type: 'Hero', points: 280, renown: 4, path: 'Path of the Warrior' },
        { id: 'oath', name: 'The Oathkeepers', type: 'Infantry', points: 300, renown: 2 },
        { id: 'flint', name: 'Flintguard', type: 'Infantry', points: 240, renown: 1, battleScars: 5, scars: 'Still bearing wounds from the fight at the crossing.' },
      ],
      quests: [
        { id: 'beacons', title: 'Relight the Watchfires', goal: 'Secure three abandoned beacons along the old road.', reward: 'Control of the beacon road', target: 3, progress: 2 },
        { id: 'standard', title: 'Recover the Fallen Standard', goal: 'Find the company standard in the ruins of Cinderfall.', reward: 'The lost company banner' },
      ],
      ledger: [{ id: 'supply', date: '2026-10-04', reason: 'Supplies for the beacon road', delta: -2 }],
    },
    {
      id: 'veil', name: 'The Hollow Host', faction: 'Nighthaunt', warlord: 'The Veiled Marshal', color: '#8eaa98',
      units: [
        { id: 'marshal', name: 'The Veiled Marshal', type: 'Hero', points: 280, renown: 3 },
        { id: 'bound', name: 'The Oathbound Dead', type: 'Infantry', points: 460, renown: 2 },
      ],
    },
  ],
  battles: [
    { id: 'crossing', title: 'The Cinderfall Crossing', date: '2026-11-14', battleplan: 'Hold the Crossing', armyId: 'forge', opponentArmyId: 'veil', result: 'Victory', delta: 4, oppDelta: 2,
      notes: 'The Oathkeepers held the bridge long enough for Dagna to light the second beacon.',
      awards: [{ id: 'award-crossing', armyId: 'forge', unitId: 'oath', unitName: 'The Oathkeepers', delta: 2 }] },
    { id: 'gate', title: 'Siege of the Ember Gate', date: '2026-10-31', battleplan: 'The Broken Gate', armyId: 'forge', opponent: 'The Iron Maw', result: 'Draw', delta: 2 },
    { id: 'valley', title: 'Into the Ashen Vale', date: '2026-10-17', armyId: 'forge', opponentArmyId: 'veil', result: 'Defeat', delta: 2, oppDelta: 3 },
  ],
  entries: [{ id: 'entry', title: 'A Light on the Old Road', date: '2026-11-14', armyId: 'forge', body: 'The second beacon burned through the night. Even from the valley floor, Dagna could see the old road take shape in its light.' }],
};

function boot({ page = 'overview', saved = new Map(), session = new Map(), fresh = false } = {}) {
  if (!fresh && saved.size === 0) saved.set(key, JSON.stringify(fixture));
  const elements = new Map();
  const events = new Map();
  const element = () => ({
    classList: { toggle() {} }, eventHandlers: new Map(), attributes: new Map(), focus() {},
    setAttribute(name, value) { this.attributes.set(name, value); },
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    addEventListener(name, callback) { this.eventHandlers.set(name, callback); },
    showModal() { this.open = true; }, close() { this.open = false; }, querySelector() { return { focus() {} }; },
  });
  const context = createContext({
    fixture,
    document: {
      querySelector(id) {
        if (!elements.has(id)) elements.set(id, element());
        return elements.get(id);
      },
      addEventListener: (name, callback) => events.set(name, callback),
    },
    localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) },
    sessionStorage: { getItem: key => session.get(key) ?? null, setItem: (key, value) => session.set(key, value) },
    window: { addEventListener: (name, callback) => events.set(name, callback), scrollTo() {} },
    FormData: class { constructor(form) { return Object.entries(form.values); } },
    location: { hash: `#${page}` },
    setTimeout() {}, clearTimeout() {}, queueMicrotask,
  });
  for (const script of scripts) script.runInContext(context);
  return { elements, events, context, run: code => runInContext(code, context) };
}

const app = boot();
const menu = app.elements.get('#menu-toggle');
assert.equal(menu.getAttribute('aria-expanded'), 'false');
menu.eventHandlers.get('click')();
assert.equal(menu.getAttribute('aria-expanded'), 'true');
app.events.get('keydown')({ key: 'Escape', preventDefault() {} });
assert.equal(menu.getAttribute('aria-expanded'), 'false');
assert.equal(app.run('new Set(Ledger.unitTypes.map(unitIcon).filter(Boolean)).size'), app.run('Ledger.unitTypes.length'));
const battleWorkflow = boot({ page: 'battle-view' });
battleWorkflow.run(`
  const warband = viewedArmy();
  const battleLog = CampaignStore.data.battles;
  warband.battleTraits.push({ id: 'trait', name: 'Faction test trait', timing: 'Combat', declare: 'Choose <target>', effect: 'Gain a bonus.' });
  warband.battleView = [{ id: 'dagna', dead: true, kills: 2, questPoints: 0 }];
  warband.units.find(unit => unit.id === 'flint').status = 'In Reserves';
`);
battleWorkflow.elements.get('#main').eventHandlers.get('input')({ target: {
  type: 'number', name: 'questPoints', value: '3', validity: { valid: true }, dataset: { id: 'dagna' },
  hasAttribute: name => name === 'data-battle-counter',
} });
assert.match(battleWorkflow.run('warbands()'), /Battle Traits[\s\S]*Faction test trait/);
assert.match(battleWorkflow.run('warbandDatacards(CampaignStore.data.campaign, warband, battleLog)'),
  /Battle Trait · Khazalite Holds[\s\S]*Faction test trait[\s\S]*Choose &lt;target&gt;/);
const liveView = battleWorkflow.run('battleView()');
assert.match(liveView, /The Oathkeepers[\s\S]*battle-view-unit is-dead[\s\S]*Dagna Emberhand/);
assert.doesNotMatch(liveView, /Flintguard/);
assert.match(battleWorkflow.run('quests()'), /data-action="new-quest" disabled/);
assert.match(battleWorkflow.run('quests()'), /data-action="forfeit-quest"/);
assert.equal(battleWorkflow.run('warband.quests[1].status'), 'Forfeited');
const battleSeed = JSON.parse(battleWorkflow.run('JSON.stringify(battleViewSeed(warband, battleLog))'));
assert.equal(battleSeed.armyId, 'forge');
assert.deepEqual(battleSeed.awards.map(({ unitId, delta, questPoints }) => [unitId, delta, questPoints]), [['dagna', undefined, 3], ['oath', undefined, 0]]);
battleWorkflow.run(`
  const active = Ledger.activeQuest(warband);
  battleLog[0].questId = active.id;
  battleLog[0].questPoints = 3;
  actions['forfeit-quest'](active.id);
  dialogEditor()();
`);
assert.match(battleWorkflow.run('quests()'), /Forfeited quests[\s\S]*Relight the Watchfires[\s\S]*5 \/ 3/);
assert.doesNotMatch(battleWorkflow.run('quests()'), /data-action="new-quest" disabled/);
assert.equal(battleWorkflow.run('Ledger.normalize(CampaignStore.data).armies[0].battleView[0].questPoints'), 3);
battleWorkflow.run(`
  warband.units.push({ ...warband.units[0], id: 'manifestation', type: 'Other', name: 'Molten Infernoth', warscroll: 'Molten Infernoth' });
  warband.lores.push(
    { kind: 'spell', name: 'Test lore', entries: [{ name: 'Test spell' }] },
    { kind: 'prayer', name: 'Test lore', entries: [{ name: 'Test prayer' }] },
    { kind: 'manifestation', name: 'Test lore', entries: [{ name: 'Test summon action' }] },
  );
`);
assert.doesNotMatch(battleWorkflow.run('battleView()'), /Molten Infernoth|Faction test trait|Test spell/);
battleWorkflow.run("selectBattleViewTab('traits')");
assert.match(battleWorkflow.run('battleView()'), /Faction test trait/);
assert.doesNotMatch(battleWorkflow.run('battleView()'), /Molten Infernoth|Dagna Emberhand/);
battleWorkflow.run("selectBattleViewTab('arcana')");
assert.match(battleWorkflow.run('battleView()'), /Test spell[\s\S]*Test prayer[\s\S]*Test summon action[\s\S]*Molten Infernoth/);
assert.doesNotMatch(battleWorkflow.run('battleView()'), /Dagna Emberhand|Faction test trait/);
assert.match(battleWorkflow.run('warbandCardList(warband, battleLog)'), /Test summon action[\s\S]*Molten Infernoth/);
assert.equal(battleWorkflow.run('sortedWarbandUnits(warband).at(-1).id'), 'manifestation');
battleWorkflow.run("selectBattleViewTab('tracker')");
const tracker = battleWorkflow.run('battleView()');
assert.equal((tracker.match(/type="radio" name="initiative-/g) || []).length, 14);
assert.doesNotMatch(tracker, /Unassigned|name="initiative-0"[^>]* checked/);
assert.match(tracker, /data-battle-round="4" hidden/);
assert.equal((tracker.match(/>Extend to next round\?</g) || []).length, 3);
assert.deepEqual([...tracker.matchAll(/name="extension-(\d+)"/g)].map(match => Number(match[1]) + 1), [4, 5, 6]);
assert.match(tracker, /The battle ends after this round\./);
assert.match(tracker, /<legend>Round 7<\/legend>/);
battleWorkflow.elements.get('#main').eventHandlers.get('input')({ target: {
  type: 'number', name: 'warbandPoints-4', value: '4', validity: { valid: true },
  hasAttribute: () => false, closest: () => ({ dataset: { battleRound: '4' } }),
} });
battleWorkflow.run(`warband.battleRounds[3].extension = 'yes'; warband.battleRounds[4].initiative = 'opponent'; warband.battleRounds[4].extension = 'yes';`);
assert.doesNotMatch(battleWorkflow.run('battleRoundTracker(warband)'), /data-battle-round="[45]" hidden/);
assert.match(battleWorkflow.run('battleRoundTracker(warband)'), /data-battle-round="6" hidden/);
assert.equal(battleWorkflow.run('battleScore(warband.battleRounds)'), '4 – 0');
assert.match(battleWorkflow.run("recordedBattleRounds(battleViewSeed(warband, battleLog).rounds, 'Forge', 'Opponent')"), /<th scope="row">5<\/th><td>Opponent<\/td><td>4<\/td>[\s\S]*Continue/);
const freshStorage = new Map();
const fresh = boot({ page: 'warbands', saved: freshStorage, fresh: true });
const setup = fresh.elements.get('#main').innerHTML;
assert.match(setup, /<h1>Campaigns<\/h1>/);
assert.match(setup, /assets\/fortress\.jpg/);
assert.match(setup, /No campaigns yet/);
assert.match(setup, /Import backup/);
assert.equal(fresh.run('CampaignStore.data'), null);
assert.equal(freshStorage.size, 0);
fresh.run('actions.start()');
const campaignDialog = fresh.elements.get('#dialog').innerHTML;
for (const name of ['name', 'pack', 'location', 'resource', 'pointsLimit', 'notes']) assert.ok(campaignDialog.includes(`name="${name}"`));
const startError = { scrollIntoView() {} };
const startForm = { id: 'editor-form', querySelector: () => startError, values: {
  name: ' ', pack: 'Custom', location: 'The Marches', resource: 'Emberstone', pointsLimit: '1250', notes: 'Use agreed house rules.',
} };
const submitStart = () => fresh.events.get('submit')({ target: startForm, preventDefault() {} });
submitStart();
assert.match(startError.textContent, /Campaign name is required/);
assert.equal(freshStorage.size, 0);
startForm.values.name = 'A New Campaign';
submitStart();
assert.match(fresh.context.location.hash, /^#?overview$/);
fresh.events.get('hashchange')();
assert.match(fresh.elements.get('#main').innerHTML, /<h1>A New Campaign<\/h1>/);
const [{ data: created }] = JSON.parse(freshStorage.get(key)).campaigns;
assert.equal(created.campaign.pointsLimit, 1250);
assert.equal(created.campaign.resource, 'Emberstone');
assert.deepEqual([created.armies, created.battles, created.entries], [[], [], []]);
assert.equal(boot({ saved: freshStorage }).run('currentPage()'), 'overview');
assert.match(fresh.elements.get('#main').innerHTML, /href="#campaigns"/);
fresh.context.location.hash = '#campaigns';
fresh.events.get('hashchange')();
assert.match(fresh.elements.get('#main').innerHTML, /A New Campaign/);
const importFile = fresh.elements.get('#import-file');
importFile.files = [{ text: async () => JSON.stringify(fixture) }];
await importFile.eventHandlers.get('change')();
assert.match(fresh.elements.get('#dialog').innerHTML, /Import Verification Campaign/);
fresh.events.get('submit')({ target: { id: 'editor-form', values: {} }, preventDefault() {} });
assert.equal(fresh.run('CampaignStore.data.campaign.name'), 'Verification Campaign');
assert.deepEqual(JSON.parse(freshStorage.get(key)).campaigns.map(({ data }) => data.campaign.name), ['A New Campaign', 'Verification Campaign']);
const campaignSession = new Map();
const campaignPicker = boot({ page: 'campaigns', saved: freshStorage, session: campaignSession });
assert.match(campaignPicker.elements.get('#main').innerHTML, /A New Campaign[\s\S]*Verification Campaign/);
campaignPicker.run("actions['open-campaign'](CampaignStore.campaigns[1].id)");
assert.match(campaignPicker.context.location.hash, /^#?overview$/);
assert.equal(campaignPicker.run('viewedArmy().id'), 'forge');
assert.equal(boot({ saved: freshStorage, session: campaignSession }).run('viewedArmy().id'), 'forge');
campaignPicker.run("actions['open-campaign'](CampaignStore.campaigns[0].id)");
assert.equal(campaignPicker.run('CampaignStore.data.armies.length'), 0);
assert.equal(campaignPicker.run('CampaignStore.data.battles.length'), 0);
const legacyPicker = boot({ page: 'campaigns' });
assert.match(legacyPicker.elements.get('#main').innerHTML, /Verification Campaign/);
legacyPicker.run('actions.start()');
legacyPicker.events.get('submit')({ target: startForm, preventDefault() {} });
assert.equal(legacyPicker.run('CampaignStore.campaigns.length'), 2);
assert.equal(legacyPicker.run('CampaignStore.data.campaign.name'), 'A New Campaign');
legacyPicker.run("actions['open-campaign'](CampaignStore.campaigns[0].id)");
assert.equal(legacyPicker.run('CampaignStore.data.battles.length'), fixture.battles.length);

const selectedSave = new Map();
const selection = boot({ page: 'warbands', saved: selectedSave });
const selectionInitial = selectedSave.get(key);
selection.run(`
  CampaignStore.data.battles.push({ ...CampaignStore.data.battles[0], id: 'veil-only', title: 'Veil-only battle', armyId: 'veil', opponentArmyId: '' });
  CampaignStore.data.entries.push({ id: 'veil-note', armyId: 'veil', title: 'Veil-only entry', date: '', body: '' });
  CampaignStore.data.entries.push({ id: 'shared-note', armyId: '', title: 'Shared entry', date: '', body: '' });
  army('veil').quests.push({ id: 'veil-quest', title: 'Veil-only quest', status: 'Active' });
  CampaignStore.data.armies[1].lores.push({ id: 'veil-lore', kind: 'spell', name: 'Veil-only lore', points: 0, entries: [] });
`);
for (const [page, content] of [['warbands', 'The Oathkeepers'], ['overview', 'Relight the Watchfires'], ['battles', 'Siege of the Ember Gate'], ['chronicle', 'A Light on the Old Road'], ['quests', 'Relight the Watchfires']]) {
  assert.match(selection.run(`${page}()`), new RegExp(content));
  assert.doesNotMatch(selection.run(`${page}()`), /Veil-only/);
}
selection.run("selectWarband('veil')");
assert.equal(selection.run('activeArmy().id'), 'forge');
assert.equal(selection.run('viewedArmy().id'), 'veil');
assert.equal(selectedSave.get(key), selectionInitial);
assert.match(selection.elements.get('#topbar').innerHTML, /Forge Of The Sunset \(Active\)[\s\S]*value="veil" selected/);
for (const [page, content] of [['warbands', 'The Oathbound Dead'], ['overview', 'Veil-only battle'], ['battles', 'Veil-only battle'], ['chronicle', 'Veil-only entry'], ['quests', 'Veil-only quest'], ['arcaneTome', 'Veil-only lore']]) {
  assert.match(selection.run(`${page}()`), new RegExp(content));
  assert.doesNotMatch(selection.run(`${page}()`), /The Oathkeepers|Relight the Watchfires|Siege of the Ember Gate|A Light on the Old Road/);
}
assert.match(selection.run('chronicle()'), /Shared entry/);
selection.run("actions['make-active-warband']()");
assert.equal(boot({ saved: selectedSave }).run('activeArmy().id'), 'veil');
selection.run(`
  const olderCampaign = Ledger.normalize(fixture);
  delete olderCampaign.activeWarbandId;
  olderCampaign.activeArmyId = 'forge';
  Object.assign(CampaignStore.data, Ledger.normalize(olderCampaign));
`);
assert.equal(selection.run('activeArmy().id'), 'veil');
selection.run("actions['archive-warband']()");
assert.equal(selection.run('activeArmy().id'), 'forge');
selection.run(`
  mountTextPicker = () => {};
  warbandForm();
  dialogEditor()({ name: 'Newest warband', faction: 'Custom', formation: '', color: '#ca935d', notes: '' });
`);
assert.equal(selection.run('activeArmy().name'), 'Newest warband');
assert.equal(selection.run('viewedArmy().name'), 'Newest warband');
const aftermath = boot();
aftermath.run(`
  const state = CampaignStore.data;
  const warband = activeArmy();
  const unit = warband.units.find(unit => unit.id === 'flint');
  const battle = state.battles[0];
  battle.awards.push({ id: 'scar-test', armyId: warband.id, unitId: unit.id, unitName: unit.name, delta: 0, scars: 13 });
`);
assert.equal(aftermath.run('Ledger.unitBattleScars(unit, warband.id, state.battles)'), 18);
assert.equal(aftermath.run('Ledger.points(warband, state.battles)'), 580);
assert.match(aftermath.run('warbands()'), /<h2>Retired<\/h2>[\s\S]*Flintguard/);
assert.doesNotMatch(aftermath.run('warbandDatacards(state.campaign, warband, state.battles)'), /Flintguard/);
assert.equal(aftermath.run('Ledger.normalize(state).battles[0].awards.at(-1).scars'), 13);
aftermath.run('battle.awards.at(-1).scars = 4');
assert.equal(aftermath.run('Ledger.unitBattleScars(unit, warband.id, state.battles)'), 9);
assert.equal(aftermath.run('Ledger.points(warband, state.battles)'), 820);
aftermath.run('battle.awards.pop()');
assert.equal(aftermath.run('Ledger.unitBattleScars(unit, warband.id, state.battles)'), 5);
const resources = boot({ page: 'warbands' });
assert.equal(resources.run('CampaignStore.data.campaign.resource'), '');
assert.equal(resources.run('Ledger.balance(CampaignStore.data, activeArmy())'), 6);
assert.match(resources.run('warbands()'), /data-icon="coin"[^>]*aria-hidden="true"[\s\S]*?<\/svg>Glory Points ledger<\/h2>/);
assert.doesNotMatch(resources.run('warbands()'), /Campaign Resources ledger<\/h2>/);
resources.run(`
  const oldCampaign = Ledger.normalize(fixture);
  oldCampaign.version = 2;
  oldCampaign.campaign.pack = 'Ravaged Coast';
  oldCampaign.campaign.resource = 'Emberstone Shards';
  Object.assign(CampaignStore.data, Ledger.normalize(oldCampaign));
`);
assert.equal(resources.run('Ledger.balance(CampaignStore.data, activeArmy())'), 0);
assert.equal(resources.run("Ledger.balance(CampaignStore.data, activeArmy(), 'resource')"), 6);
assert.equal(resources.run("Ledger.balance(CampaignStore.data, CampaignStore.data.armies[1], 'resource')"), 5);
assert.match(resources.run('warbands()'), /Glory Points ledger[\s\S]*Emberstone Shards ledger/);
resources.run(`
  CampaignStore.data.battles[0].delta = 3;
  CampaignStore.data.campaign.resource = '';
  Object.assign(CampaignStore.data, Ledger.normalize(CampaignStore.data));
`);
assert.equal(resources.run('Ledger.balance(CampaignStore.data, activeArmy())'), 3);
assert.equal(resources.run("Ledger.balance(CampaignStore.data, activeArmy(), 'resource')"), 6);
assert.doesNotMatch(resources.run('warbands()'), /Emberstone Shards ledger/);
const editing = boot();
const editorDialog = editing.elements.get('#dialog');
const closePrompt = editing.elements.get('#unsaved-dialog');
const nameInput = { name: 'name', value: 'Original' };
let submitRequests = 0;
const editorForm = { querySelectorAll: () => [nameInput], requestSubmit: () => { submitRequests++; } };
const editorQuery = editorDialog.querySelector;
editorDialog.querySelector = selector => selector === '#editor-form' ? editorForm : editorQuery(selector);
for (const element of [editorDialog, closePrompt]) {
  element.close = () => { element.open = false; element.eventHandlers.get('close')?.(); };
}
editing.run("formDialog('Edit card', field('Name', 'name', 'Original'), () => [])");
await Promise.resolve();
editing.run('requestDialogClose()');
assert.equal(editorDialog.open, false);
assert.ok(!closePrompt.open);
editing.run("formDialog('Edit card', field('Name', 'name', 'Original'), () => [])");
await Promise.resolve();
nameInput.value = 'Edited';
editorDialog.eventHandlers.get('cancel')({ preventDefault() {} });
assert.equal(closePrompt.open, true);
closePrompt.returnValue = 'cancel';
closePrompt.close();
assert.equal(editorDialog.open, true);
assert.equal(nameInput.value, 'Edited');
editing.run('requestDialogClose()');
closePrompt.returnValue = 'save';
closePrompt.close();
assert.equal(submitRequests, 1);
editing.run('requestDialogClose()');
closePrompt.returnValue = 'discard';
closePrompt.close();
assert.equal(editorDialog.open, false);
assert.equal(submitRequests, 1);
const reserves = boot({ page: 'warbands' });
reserves.run(`
  const warband = activeArmy();
  warband.units.find(unit => unit.id === 'oath').status = 'In Reserves';
  warband.units.find(unit => unit.id === 'flint').battleScars = ['Serious', 'Critical'];
  warband.units.push({ ...warband.units[0], id: 'retired', name: 'Retired example', battleScars: 18 });
  Object.assign(CampaignStore.data, Ledger.normalize(CampaignStore.data));
`);
reserves.run('const scarWarband = activeArmy()');
assert.equal(reserves.run('Ledger.points(scarWarband)'), 820);
assert.equal(reserves.run("Ledger.battleReady(warband.units.find(unit => unit.id === 'oath'))"), false);
assert.match(reserves.run('warbands()'), /<h2>Reserved<\/h2>[\s\S]*The Oathkeepers[\s\S]*<h2>Retired<\/h2>[\s\S]*Retired example/);
const reserveCards = reserves.run('warbandDatacards(CampaignStore.data.campaign, scarWarband, CampaignStore.data.battles)');
assert.match(reserveCards, /Dagna Emberhand<\/h2>[\s\S]*dc-warlord">Warlord<\/span>[\s\S]*Flintguard<\/h2>[\s\S]*dc-status">Scarred<\/span>/);
assert.equal(reserves.run("scarWarband.units.find(unit => unit.id === 'flint').battleScars"), 13);
assert.doesNotMatch(reserveCards, /The Oathkeepers|Retired example|>Active<|>In Reserves</);
assert.deepEqual(JSON.parse(reserves.run('JSON.stringify([0, 4, 5, 8, 9, 12, 13, 17, 18, 25].map(Ledger.battleScarSeverity))')),
  ['-', '-', 'Serious', 'Serious', 'Severe', 'Severe', 'Critical', 'Critical', 'Succumbed to injuries', 'Succumbed to injuries']);
const formationApp = boot({ page: 'warbands' });
assert.equal(formationApp.run('activeArmy().formation'), '');
formationApp.run(`
  activeArmy().formation = '  Custom Vanguard  ';
  Object.assign(CampaignStore.data, Ledger.normalize(CampaignStore.data));
`);
assert.equal(formationApp.run('activeArmy().formation'), 'Custom Vanguard');
assert.match(formationApp.run('warbands()'), /Battle Formation[\s\S]*Custom Vanguard/);
for (const page of ['overview', 'warbands', 'battle-view', 'battles', 'arcane-tome', 'quests', 'chronicle', 'settings']) {
  app.context.location.hash = `#${page}`;
  app.events.get('hashchange')();
  assert.ok(app.elements.get('#main').innerHTML.includes('<h1>'), `Page did not render: ${page}`);
}
const tomeSave = new Map();
const tome = boot({ page: 'arcane-tome', saved: tomeSave });
assert.equal(tome.run('Ledger.lorePoints(activeArmy())'), 0);
assert.match(tome.elements.get('#main').innerHTML, /Spell Lore[\s\S]*Prayer Lore[\s\S]*Manifestation Lore/);
tome.run(`
  const firstArmy = activeArmy();
  const firstArmyBasePoints = Ledger.points(firstArmy);
  actions['new-lore']('spell');
`);
assert.match(tome.elements.get('#dialog').innerHTML, /Battle point cost[\s\S]*value="0"/);
assert.throws(() => tome.run("dialogEditor()({ name: 'Ember Lore', points: '-1' })"), /valid whole number/);
tome.run(`
  dialogEditor()({ name: 'Ember Lore', points: '40' });
  const spellLore = firstArmy.lores[0];
  actions['new-lore-entry'](spellLore.id);
`);
const entryForm = tome.elements.get('#dialog').innerHTML;
assert.match(entryForm, /class="field"><label for="field-name">Name<\/label>[\s\S]*class="field"><label for="field-value">Casting value<\/label>/);
assert.match(entryForm, /Declare<\/label><textarea[\s\S]*Effect<\/label><textarea/);
assert.doesNotMatch(entryForm, /field-timing/);
tome.run(`
  dialogEditor()({ name: 'Watchfire', value: '6', declare: '<target>', effect: '<effect>' });
  actions['new-lore']('prayer');
  dialogEditor()({ name: 'Ashen Rites', points: '' });
  actions['new-lore-entry'](firstArmy.lores[1].id);
  dialogEditor()({ name: 'Ashen Prayer', value: '4', declare: '', effect: '' });
  actions['new-lore']('manifestation');
  dialogEditor()({ name: 'Flames of Ember', points: '20' });
  actions['new-lore-entry'](firstArmy.lores[2].id);
  dialogEditor()({ name: 'Ember Spirit', value: '7', declare: '', effect: '' });
  commit('Lore added.');
`);
assert.equal(tome.run('Ledger.points(firstArmy) - firstArmyBasePoints'), 60);
assert.match(tome.run('warbands()'), /Includes 60 battle pts from Arcane Tome/);
assert.match(tome.elements.get('#main').innerHTML, /Watchfire[\s\S]*Casting value[\s\S]*Declare<\/strong> &lt;target&gt;[\s\S]*Effect<\/strong> &lt;effect&gt;/);
assert.match(tome.elements.get('#main').innerHTML, /Add prayer[\s\S]*Ashen Prayer[\s\S]*Chanting value[\s\S]*Add manifestation[\s\S]*Ember Spirit[\s\S]*Summoning value/);
const reloadedTome = boot({ page: 'arcane-tome', saved: tomeSave });
const arcaneExport = reloadedTome.run(`
  const tomeWarband = activeArmy();
  const loreOnlyWarband = { ...tomeWarband, units: [] };
  warbandDatacards(CampaignStore.data.campaign, loreOnlyWarband, CampaignStore.data.battles);
`);
assert.equal((arcaneExport.match(/class="datacard dc-lore-card"/g) || []).length, 3);
assert.match(arcaneExport, /Spell Lore · Ember Lore[\s\S]*Watchfire[\s\S]*Casting value 6[\s\S]*Print card[\s\S]*&lt;target&gt;[\s\S]*&lt;effect&gt;/);
assert.match(arcaneExport, /Ashen Prayer[\s\S]*Chanting value 4[\s\S]*Ember Spirit[\s\S]*Summoning value 7/);
assert.match(arcaneExport, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(arcaneExport, /@media screen and \(max-width: 720px\)/);
assert.doesNotMatch(arcaneExport, /<link rel="stylesheet"/, 'Standalone export must embed its styles');
assert.equal(reloadedTome.run('hasWarbandDatacards(loreOnlyWarband)'), true);
assert.doesNotMatch(reloadedTome.run('warbandCardList(tomeWarband, CampaignStore.data.battles, { unit: tomeWarband.units[0] })'), /Watchfire/);
assert.equal(reloadedTome.run('Ledger.lorePoints(activeArmy())'), 60);
assert.match(reloadedTome.elements.get('#main').innerHTML, /Watchfire/);
assert.equal(reloadedTome.run('activeArmy().lores[0].entries[0].declare'), '<target>');
assert.equal(reloadedTome.run(`
  const olderTome = JSON.parse(JSON.stringify(CampaignStore.data));
  const olderEntry = olderTome.armies[0].lores[0].entries[0];
  delete olderEntry.declare;
  olderEntry.timing = 'Your Hero Phase';
  Ledger.normalize(olderTome).armies[0].lores[0].entries[0].declare;
`), 'Your Hero Phase');
tome.run('selectWarband(CampaignStore.data.armies[1].id)');
assert.doesNotMatch(tome.elements.get('#main').innerHTML, /Ember Lore|Watchfire/);
tome.run(`
  selectWarband(firstArmy.id);
  const entryRef = JSON.stringify([spellLore.id, spellLore.entries[0].id]);
  actions['edit-lore-entry'](entryRef);
  dialogEditor()({ name: 'Watchfire', value: '7', declare: 'Pick a target.', effect: '' });
`);
assert.equal(tome.run('spellLore.entries[0].value'), '7');
tome.run(`
  actions['remove-lore-entry'](entryRef);
  dialogEditor()();
  actions['edit-lore'](spellLore.id);
  dialogEditor()({ name: 'Ember Lore', points: '30' });
`);
assert.equal(tome.run('Ledger.points(firstArmy) - firstArmyBasePoints'), 50);
assert.equal(tome.run('spellLore.entries.length'), 0);
tome.run(`
  actions['remove-lore'](spellLore.id);
  dialogEditor()();
`);
assert.equal(tome.run('Ledger.points(firstArmy) - firstArmyBasePoints'), 20);
assert.ok(app.run('CampaignStore.data.armies.length > 0'));
assert.match(app.run('warbands()'), /Export datacards/);
const normalCards = app.run('warbandDatacards(CampaignStore.data.campaign, activeArmy(), CampaignStore.data.battles)');
assert.equal((normalCards.match(/<article class="datacard"/g) || []).length, app.run('activeArmy().units.length'));
assert.match(normalCards, /Print or save PDF/);
assert.match(normalCards, /@media print/);
assert.match(app.run('warbands()'), /Dagna Emberhand[\s\S]*Flintguard[\s\S]*The Oathkeepers/);
assert.match(normalCards, /Dagna Emberhand[\s\S]*Flintguard[\s\S]*The Oathkeepers/);
assert.deepEqual(JSON.parse(app.run(`JSON.stringify(Ledger.sortedUnits([
  {name:'Alpha',type:'Cavalry'}, {name:'Zora',type:'Hero'}, {name:'beta',type:'Hero'}, {name:'Amber',type:'Infantry'}
]).map(unit=>unit.name))`)), ['beta', 'Zora', 'Amber', 'Alpha']);

app.run(`activeArmy().faction = 'Khazalite Holds';
  const checkedUnit = activeArmy().units[0];
  checkedUnit.warscroll = 'Auric Runemaster';
  checkedUnit.profileEdits = { abilities: [
    { name: 'MASTER OF THE RUNES', kind: 'Ability', timing: '', effect: '' },
    { name: 'Test Path upgrade', kind: 'Path upgrade', timing: 'Combat Phase', effect: '<example>' },
  ] };`);
const customCards = app.run('warbandDatacards(CampaignStore.data.campaign, activeArmy(), CampaignStore.data.battles)');
assert.match(customCards, /MASTER OF THE RUNES/);
assert.match(customCards, /Your Hero Phase/);
assert.match(customCards, /Test Path upgrade/);
assert.match(customCards, /&lt;example&gt;/);
assert.doesNotMatch(customCards, /<example>/);
assert.equal(app.run('unitCatalogueEntry(activeArmy(), checkedUnit).name'), 'Auric Runemaster');
assert.deepEqual(JSON.parse(app.run('JSON.stringify(Ledger.unitTypes)')), ['Hero', 'Infantry', 'Cavalry', 'War Machine', 'Monster', 'Terrain', 'Other', 'Manifestation']);
assert.equal(app.run('BattleCatalogueData.entries.every(entry => Ledger.unitTypes.includes(entry.category))'), true);
assert.equal(app.run('WahapediaCatalogueData.entries.every(entry => Ledger.unitTypes.includes(entry.category))'), true);
assert.equal(app.run(`BattleCatalogue.find('Khazalite Holds', 'Oathkeeper Cannon').category`), 'War Machine');
assert.match(app.run('profileEditorFields(true)'), /Add Path upgrade/);
assert.match(app.run(`textPicker('Warscroll','warscroll','Custom <hero>')`), /value="Custom &lt;hero&gt;"[\s\S]*role="combobox"/);
assert.match(app.run(`textPicker('Faction','faction','',{required:true})`), /name="faction"[\s\S]*required[\s\S]*id="faction-options"/);
assert.equal(app.run(`textPickerChoices(BattleCatalogue.list('Khazalite Holds'), 'rune master')[0].name`), 'Auric Runemaster');
assert.equal(app.run(`textPickerChoices(BattleCatalogue.list('Khazalite Holds'), 'Auric Runemaster').some(choice => choice.custom)`), false);
assert.equal(app.run(`textPickerChoices([{name:'Khazalite Holds'}], ' My custom faction ').at(-1).name`), 'My custom faction');
app.run('viewWarbandDatacards(activeArmy(), checkedUnit)');
assert.match(app.elements.get('#dialog').innerHTML, /Test Path upgrade/);
app.run(`checkedUnit.type = 'Terrain'; viewWarbandDatacards(activeArmy(), checkedUnit);`);
assert.match(app.elements.get('#dialog').innerHTML, /class="dc-label">Terrain<\/p>/);

app.run(`
  checkedUnit.points = 120;
  checkedUnit.size = 5;
  const baseRosterPoints = Ledger.points(activeArmy());
  checkedUnit.reinforced = true;
`);
assert.equal(app.run('Ledger.unitPoints(checkedUnit)'), 240);
assert.equal(app.run('Ledger.unitSize(checkedUnit)'), 10);
assert.equal(app.run('Ledger.points(activeArmy()) - baseRosterPoints'), 120);
assert.match(app.run('unitCard(activeArmy(), checkedUnit)'), /Reinforced[\s\S]*240 pts[\s\S]*10<\/strong> models/);
const reinforcedCards = app.run('warbandDatacards(CampaignStore.data.campaign, activeArmy(), CampaignStore.data.battles)');
assert.match(reinforcedCards, /Reinforced[\s\S]*Points<\/dt><dd>240<\/dd>[\s\S]*Models<\/dt><dd>10<\/dd>/);
assert.deepEqual(JSON.parse(app.run(`JSON.stringify(Ledger.normalize(CampaignStore.data).armies[0].units[0])`)),
  JSON.parse(app.run('JSON.stringify(checkedUnit)')));
app.run('checkedUnit.reinforced = false');
assert.equal(app.run('Ledger.points(activeArmy()) - baseRosterPoints'), 0);
assert.equal(app.run('Ledger.unitSize(checkedUnit)'), 5);

assert.match(app.run('warbands()'), /Add Anvil hero/);
const newAnvilFields = app.run('anvilFields()');
assert.match(newAnvilFields, /name="anvil-limit" value=""/);
assert.match(newAnvilFields, /id="anvil-choices"><\/div>/);
assert.match(newAnvilFields, /^<details[^>]*>\s*<summary>Anvil of Apotheosis<\/summary>/);
assert.match(app.run('unitUpgradeFields()'), /^<details[^>]*><summary>Upgrades<\/summary>/);
const upgradedUnit = { id: 'upgraded', name: 'Test Hero', type: 'Hero', status: 'Active', points: 120, reinforced: true, upgrades: [
  { type: 'Hero Trait', name: 'Battle Wisdom', cost: 25, description: 'Example rule' },
  { type: 'Enhancement', name: 'Banner', cost: 0, description: '' },
] };
app.context.upgradeFixture = upgradedUnit;
assert.equal(app.run('Ledger.unitPoints(upgradeFixture)'), 265);
assert.equal(app.run("Ledger.points({ units: [upgradeFixture, { ...upgradeFixture, status: 'Retired' }] })"), 265);
assert.match(app.run('unitCard(activeArmy(), upgradeFixture)'), /265 pts/);
assert.deepEqual(JSON.parse(app.run(`
  const upgradedCampaign = Ledger.normalize(fixture);
  upgradedCampaign.armies[0].units.push(upgradeFixture);
  JSON.stringify(Ledger.normalize(upgradedCampaign).armies[0].units.at(-1).upgrades);
`)), upgradedUnit.upgrades);
const stageLabels = ['Archetype', 'Origin', 'Flaw', 'Battle Mount', 'Battle Mount Upgrades', 'Other Upgrades'];
const stageField = app.run(`anvilStageField('anvil-choice-1-stage')`);
assert.deepEqual([...stageField.matchAll(/<option value="([^"]+)"(?: selected)?>/g)].map(match => match[1]), stageLabels);
assert.match(stageField, /<option value="" selected disabled>Choose A Stage<\/option>/);
assert.match(app.run(`anvilStageField('anvil-choice-1-stage', 'battle mount')`), /<option value="Battle Mount" selected>/);
assert.match(app.run(`anvilStageField('anvil-choice-1-stage','Legacy & stage')`), /<option value="Legacy &amp; stage" selected disabled>/);
const anvilPresets = [
  ['Anvil of Apotheosis - Novice', { limit: 10, points: 150 }],
  ['Anvil of Apotheosis - Veteran', { limit: 30, points: 250 }],
  ['Anvil of Apotheosis - Lord', { limit: 50, points: 350 }],
];
assert.deepEqual(JSON.parse(app.run('JSON.stringify([...anvilWarscrolls])')), anvilPresets);
assert.deepEqual([...app.run('anvilWarscrollField()').matchAll(/<option value="([^"]+)">/g)].map(match => match[1]), anvilPresets.map(([name]) => name));
assert.match(app.run(`anvilWarscrollField('Previous custom hero')`), /<option value="Previous custom hero" selected disabled>/);
app.run(`checkedUnit.type = 'Hero';
  checkedUnit.anvil = Ledger.normalizeAnvil({ limit: 20, rules: 'Campaign variant', choices: [
    { stage: 'Origin', name: 'Stone-born', cost: 4, notes: 'Original origin' },
    { stage: 'Flaw', name: 'Oathbound', cost: -2 },
  ] });`);
assert.equal(app.run('Ledger.destinySpent(checkedUnit.anvil)'), 2);
assert.equal(app.run('Ledger.unitPoints(checkedUnit)'), 120);
assert.match(app.run('anvilSummary(checkedUnit.anvil)'), /2 \/ 20 Destiny Points spent · 18 remaining/);
assert.match(app.run('warbandDatacards(CampaignStore.data.campaign, activeArmy(), CampaignStore.data.battles)'), /Anvil of Apotheosis[\s\S]*Stone-born[\s\S]*Oathbound/);
assert.equal(app.run('JSON.stringify(Ledger.normalize(CampaignStore.data).armies[0].units[0].anvil)'), app.run('JSON.stringify(checkedUnit.anvil)'));
app.run(`checkedUnit.warscroll = 'Anvil of Apotheosis - Veteran'; checkedUnit.points = 260; checkedUnit.anvil.limit = 32;`);
assert.deepEqual(JSON.parse(app.run(`JSON.stringify((() => {
  const hero = Ledger.normalize(CampaignStore.data).armies[0].units[0];
  return [hero.warscroll, hero.points, hero.anvil.limit];
})())`)), ['Anvil of Apotheosis - Veteran', 260, 32]);
assert.equal(app.run('Ledger.normalizeAnvil({ limit: "" }).limit'), null);

app.run(`BattleCatalogue.rules = () => ({
  battleTraits: [{ name: 'Faction trait', timing: 'Passive', declare: '', effect: 'Faction effect' }],
  battleFormations: [{ name: 'Test formation', abilities: [{ name: 'Formation trait', timing: 'Combat', declare: 'Pick a unit', effect: 'Formation effect' }] }],
  lores: { spell: [{ name: 'Test spell lore', kind: 'spell', points: 0, entries: [{ name: 'Test spell', value: '7', declare: 'Pick a caster', effect: 'Spell effect' }] }], prayer: [] },
});`);
const importedRules = JSON.parse(app.run(`JSON.stringify(importedWarbandRules('Test faction', 'Test formation'))`));
assert.deepEqual(importedRules.battleTraits.map(trait => trait.name), ['Faction trait', 'Formation trait']);
assert.deepEqual(importedRules.lores.map(lore => [lore.kind, lore.name, lore.entries[0].value]), [['spell', 'Test spell lore', '7']]);

// Exercise the reference picker through its events and save callbacks, including
// customization and a second import into a lore that already contains edits.
const importEditor = boot();
importEditor.run(`
  const referenceRules = {
    battleTraits: [{ name: 'Imported trait', timing: 'Passive', effect: 'Original trait' }],
    battleFormations: [{ name: 'Imported formation', abilities: [{ name: 'Formation ability', timing: 'Combat', effect: 'Formation effect' }] }],
    lores: { spell: [{ name: 'Imported lore', kind: 'spell', points: 20, entries: [
      { name: 'Imported spell', value: '6', declare: 'Choose a caster', effect: 'Original spell' },
      { name: 'Second spell', value: '7', effect: 'Second effect' },
    ] }] },
  };
  BattleCatalogue.rules = () => referenceRules;
  BattleCatalogue.lores = (faction, kind) => referenceRules.lores[kind] || [];
  globalThis.Event = class { constructor(type) { this.type = type; } };
  const controls = Object.fromEntries(['name', 'timing', 'value', 'declare', 'effect', 'points', 'importedChoice'].map(key => [key, {
    value: '', handlers: {}, addEventListener(type, callback) { this.handlers[type] = callback; },
  }]));
  const applyReference = { handlers: {}, addEventListener(type, callback) { this.handlers[type] = callback; } };
  const editorStatus = {};
  const editorForm = { elements: controls, querySelectorAll() { return []; }, dispatchEvent() {}, querySelector(selector) {
    return selector === '#apply-imported-choice' ? applyReference : editorStatus;
  } };
  dialog.querySelector = selector => selector === '#editor-form' ? editorForm : { focus() {} };
  function useReference(index) {
    controls.importedChoice.value = String(index);
    controls.importedChoice.handlers.change();
    applyReference.handlers.click();
  }
  battleTraitForm(activeArmy());
  useReference(0);
  controls.effect.value = 'Customized trait';
  dialogEditor()({ name: controls.name.value, timing: controls.timing.value, declare: controls.declare.value, effect: controls.effect.value });
`);
assert.equal(importEditor.run('activeArmy().battleTraits.at(-1).effect'), 'Customized trait');
assert.equal(importEditor.run('referenceRules.battleTraits[0].effect'), 'Original trait');
importEditor.run(`
  loreForm(activeArmy(), 'spell');
  useReference(0);
  dialogEditor()({ name: 'My customized lore', points: '25' });
  const myLore = activeArmy().lores.at(-1);
  myLore.entries[0].effect = 'Keep my spell edit';
  loreForm(activeArmy(), 'spell', myLore);
  useReference(0);
  dialogEditor()({ name: myLore.name, points: '25' });
`);
assert.equal(importEditor.run('myLore.entries.length'), 2);
assert.equal(importEditor.run('myLore.entries[0].effect'), 'Keep my spell edit');
assert.equal(importEditor.run('referenceRules.lores.spell[0].entries[0].effect'), 'Original spell');
importEditor.run(`
  loreEntryForm(myLore, myLore.entries[1]);
  useReference(0);
  dialogEditor()({ name: 'Custom spell name', value: '8', declare: controls.declare.value, effect: 'Custom spell effect' });
`);
assert.equal(importEditor.run('myLore.entries[1].value'), '8');
assert.equal(importEditor.run('myLore.entries[1].name'), 'Custom spell name');
assert.equal(importEditor.run('Ledger.normalize(CampaignStore.data).armies[0].lores.at(-1).entries[0].effect'), 'Keep my spell edit');

const manifestationApp = boot();
assert.doesNotMatch(manifestationApp.run('battleTraitsSection(activeArmy())'), /Import faction rules/);
assert.match(manifestationApp.run('warbandImportFields("Khazalite Holds")'), /Manifestation Lore to import/);
assert.equal(manifestationApp.run('BattleCatalogue.factions.includes("Endless Spells")'), false);
manifestationApp.run(`
  const shared = BattleCatalogue.lores('Khazalite Holds', 'manifestation');
  const sharedIndex = shared.findIndex(lore => lore.name === 'Morbid Conjuration');
  const privateIndex = shared.findIndex(lore => lore.name === 'Magmic Invocations');
  if (sharedIndex < 0 || privateIndex < 0) throw new Error('Missing shared or faction manifestation lores');
  const manifestationArmy = activeArmy();
  const manifestationSettings = { includeFactionRules: 'on', 'import-manifestation': String(sharedIndex), includeManifestationUnits: 'on' };
  // Emulate an older warband with no optional collections.
  delete manifestationArmy.battleTraits;
  delete manifestationArmy.lores;
  applyWarbandImport(manifestationArmy, manifestationSettings);
  manifestationArmy.battleTraits[0].effect = 'Keep trait customization';
  manifestationArmy.lores[0].entries[0].effect = 'Keep summon customization';
  const counts = [manifestationArmy.battleTraits.length, manifestationArmy.lores.length, manifestationArmy.units.length];
  applyWarbandImport(manifestationArmy, manifestationSettings);
  if (JSON.stringify(counts) !== JSON.stringify([manifestationArmy.battleTraits.length, manifestationArmy.lores.length, manifestationArmy.units.length])) throw new Error('Repeated import created duplicate records');
  applyWarbandImport(manifestationArmy, { 'import-manifestation': String(privateIndex), includeManifestationUnits: 'on' });
`);
assert.equal(manifestationApp.run('manifestationArmy.battleTraits[0].effect'), 'Keep trait customization');
assert.equal(manifestationApp.run('manifestationArmy.lores[0].entries[0].effect'), 'Keep summon customization');
assert.equal(manifestationApp.run('manifestationArmy.lores.length'), 2);
assert.equal(manifestationApp.run('manifestationArmy.units.filter(unit => unit.type === "Manifestation").length'), 7);
assert.ok(manifestationApp.run('catalogueProfile(unitCatalogueEntry(manifestationArmy, manifestationArmy.units.find(unit => unit.warscroll === "Purple Sun of Shyish")))?.health'));
assert.ok(manifestationApp.run('catalogueProfile(unitCatalogueEntry(manifestationArmy, manifestationArmy.units.find(unit => unit.warscroll === "Runic Fyrewall")))?.health'));
assert.equal(manifestationApp.run('Ledger.normalize(CampaignStore.data).armies[0].lores[0].entries[0].effect'), 'Keep summon customization');
assert.match(manifestationApp.run('warbandDatacards(CampaignStore.data.campaign, manifestationArmy, CampaignStore.data.battles)'), /Purple Sun of Shyish/);

assert.equal(manifestationApp.run(`optionTitle('THORGRIM’S BEARD! mixed CASE')`), 'Thorgrim’s Beard! Mixed Case');
assert.match(manifestationApp.run(`select('Test', 'test', [['RAW_ID', 'ALL CAPS mixed']], 'RAW_ID')`), /value="RAW_ID" selected>All Caps Mixed/);
manifestationApp.run(`
  const armyGroup = traitRulesets(manifestationArmy).find(group => group.name === 'Lofnir Drothkeepers');
  if (!armyGroup) throw new Error('Missing Army of Renown traits');
  importTraitList(manifestationArmy, armyGroup.id);
  const importedArmyTrait = manifestationArmy.battleTraits.find(trait => trait.ruleset === armyGroup.id);
  importedArmyTrait.effect = 'Custom Army of Renown effect';
  if (importTraitList(manifestationArmy, armyGroup.id) !== 0) throw new Error('Repeated full-list import created duplicates');
`);
assert.equal(manifestationApp.run('importedArmyTrait.effect'), 'Custom Army of Renown effect');
assert.match(manifestationApp.run('battleTraitsSection(manifestationArmy)'), /Standard Faction[\s\S]*Lofnir Drothkeepers/);
assert.equal(manifestationApp.run('Ledger.normalize(CampaignStore.data).armies[0].battleTraits.find(trait => trait.id === importedArmyTrait.id).ruleset'), 'lofnir-drothkeepers');

const deletion = boot();
deletion.run(`
  CampaignStore.data.entries.push({ id: 'shared-note', armyId: '', title: 'Shared', body: 'Keep', date: '2026-11-20' });
  CampaignStore.data.battles[0].awards.push({ id: 'survivor-award', armyId: 'veil', unitId: 'marshal', delta: 3, scars: 2 });
  actions['remove-warband']();
`);
assert.match(deletion.elements.get('#dialog').innerHTML, /Permanently removes[\s\S]*Remove warband/);
assert.equal(deletion.run('CampaignStore.data.armies.length'), 2, 'Opening confirmation must not delete');
deletion.run('dialogEditor()()');
assert.equal(deletion.run('activeArmy().id'), 'veil');
assert.equal(deletion.run('viewedArmy().id'), 'veil');
assert.equal(deletion.run('CampaignStore.data.battles.length'), 2);
assert.equal(deletion.run('CampaignStore.data.battles[0].result'), 'Defeat');
assert.equal(deletion.run('CampaignStore.data.battles[0].delta'), 2);
assert.equal(deletion.run('CampaignStore.data.battles[0].opponent'), 'Forge of the Sunset');
assert.equal(deletion.run('CampaignStore.data.battles[0].awards[0].armyId'), 'veil');
assert.equal(deletion.run('CampaignStore.data.entries[0].id'), 'shared-note');
deletion.run(`actions['remove-warband'](); dialogEditor()();`);
assert.equal(deletion.run('CampaignStore.data.armies.length'), 0);
assert.equal(deletion.run('CampaignStore.data.activeWarbandId'), '');
assert.match(deletion.run('warbands()'), /No warbands yet/);
const opponentDeletion = boot();
opponentDeletion.run(`selectWarband('veil'); actions['remove-warband'](); dialogEditor()();`);
assert.equal(opponentDeletion.run('activeArmy().id'), 'forge');
assert.equal(opponentDeletion.run('CampaignStore.data.battles.length'), 3);
assert.equal(opponentDeletion.run('CampaignStore.data.battles[0].result'), 'Victory');
assert.equal(opponentDeletion.run('CampaignStore.data.battles[0].opponentArmyId'), '');
assert.equal(opponentDeletion.run('CampaignStore.data.battles[0].delta'), 4);
assert.equal(opponentDeletion.run('Ledger.normalize(CampaignStore.data).armies.length'), 1);

const legacy = JSON.parse(app.run('JSON.stringify(Ledger.normalize(fixture))'));
legacy.version = 1;
legacy.campaign.name = 'Migration example';
delete legacy.armies[0].units[0].profileEdits;
delete legacy.armies[0].units[0].reinforced;
legacy.armies[0].units[0].type = 'Artillery';
legacy.armies[0].units[1].type = 'Beast';
legacy.armies[0].units[2].type = 'Construct';
const saved = new Map([['ptg_campaign_ledger_v1', JSON.stringify(legacy)]]);
const migrated = boot({ saved });
assert.equal(migrated.run('CampaignStore.data.campaign.name'), legacy.campaign.name);
assert.equal(JSON.parse(saved.get(key)).campaigns[0].data.version, 3);
const uuidV4 = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
assert.match(JSON.parse(saved.get(key)).campaigns[0].id, uuidV4);
assert.equal(migrated.run('activeArmy().units[0].reinforced'), false);
assert.deepEqual(JSON.parse(migrated.run('JSON.stringify(activeArmy().units.map(unit => unit.type))')), ['War Machine', 'Other', 'Other']);

const oldCampaignList = new Map([[key, JSON.stringify({ campaigns: [
  { id: 'abc-def', data: fixture }, { id: 'legacy', data: legacy },
] })]]);
const oldCampaignSelection = new Map([['ptg_selected_campaign', 'legacy']]);
const rekeyed = boot({ saved: oldCampaignList, session: oldCampaignSelection });
const [replaced, updated] = JSON.parse(oldCampaignList.get(key)).campaigns;
assert.match(replaced.id, uuidV4);
assert.match(updated.id, uuidV4);
assert.equal(oldCampaignSelection.get('ptg_selected_campaign'), updated.id);
assert.equal(rekeyed.run('CampaignStore.data.campaign.name'), legacy.campaign.name);
assert.equal(boot({ saved: oldCampaignList, session: oldCampaignSelection }).run('CampaignStore.data.campaign.name'), legacy.campaign.name);

const external = JSON.parse(saved.get(key));
external.campaigns[0].data.campaign.name = 'Edited in another tab';
saved.set(key, JSON.stringify(external));
migrated.events.get('storage')({ key, newValue: saved.get(key) });
assert.equal(migrated.run('CampaignStore.data.campaign.name'), external.campaigns[0].data.campaign.name);
external.campaigns[0].data.activeWarbandId = 'veil';
saved.set(key, JSON.stringify(external));
assert.equal(migrated.run('CampaignStore.save()'), false);
assert.equal(migrated.run('CampaignStore.conflict'), true);
assert.equal(JSON.parse(saved.get(key)).campaigns[0].data.activeWarbandId, 'veil');

console.log('Campaign Ledger checks passed: assets, first-run setup, routes, editors, battle aftermath, datacards, and backup compatibility.');
