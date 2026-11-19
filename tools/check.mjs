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
const scripts = await Promise.all(entries.map(async path => new Script(await readFile(asset(path), 'utf8'), { filename: path })));
for (const [, stylesheet] of html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)) {
  const url = asset(stylesheet);
  const css = await readFile(url, 'utf8');
  for (const [, path] of css.matchAll(/url\(['"]([^'"]+)['"]\)/g)) await readFile(asset(path, url));
}

function boot({ page = 'overview', saved = new Map() } = {}) {
  const elements = new Map();
  const events = new Map();
  const element = () => ({
    classList: { toggle() {} }, addEventListener() {}, focus() {},
    showModal() { this.open = true; }, querySelector() { return { focus() {} }; },
  });
  const context = createContext({
    document: {
      querySelector(id) {
        if (!elements.has(id)) elements.set(id, element());
        return elements.get(id);
      },
      addEventListener() {},
    },
    localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) },
    window: { addEventListener: (name, callback) => events.set(name, callback), scrollTo() {} },
    location: { hash: `#${page}` },
    setTimeout() {}, clearTimeout() {},
  });
  for (const script of scripts) script.runInContext(context);
  return { elements, events, context, run: code => runInContext(code, context) };
}

const app = boot();
for (const page of ['overview', 'warbands', 'battles', 'quests', 'chronicle', 'settings']) {
  app.context.location.hash = `#${page}`;
  app.events.get('hashchange')();
  assert.ok(app.elements.get('#main').innerHTML.includes('<h1>'), `Page did not render: ${page}`);
}
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
assert.deepEqual(JSON.parse(app.run('JSON.stringify(Ledger.unitTypes)')), ['Hero', 'Infantry', 'Cavalry', 'War Machine', 'Monster', 'Terrain', 'Other']);
assert.equal(app.run('BattleCatalogueData.entries.every(entry => Ledger.unitTypes.includes(entry.category))'), true);
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
const stageLabels = ['Archetype', 'Origin', 'Flaw', 'Battle Mount', 'Battle Mount Upgrades', 'Other Upgrades'];
const stageField = app.run(`anvilStageField('anvil-choice-1-stage')`);
assert.deepEqual([...stageField.matchAll(/<option value="([^"]+)"(?: selected)?>/g)].map(match => match[1]), stageLabels);
assert.match(stageField, /<option value="" selected disabled>Choose a stage<\/option>/);
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

const legacy = JSON.parse(app.run('JSON.stringify(Ledger.sample())'));
legacy.version = 1;
legacy.campaign.name = 'Migration example';
delete legacy.armies[0].units[0].profileEdits;
delete legacy.armies[0].units[0].reinforced;
legacy.armies[0].units[0].type = 'Artillery';
legacy.armies[0].units[1].type = 'Beast';
legacy.armies[0].units[2].type = 'Construct';
const key = 'ptg_campaign_ledger_v2';
const saved = new Map([['ptg_campaign_ledger_v1', JSON.stringify(legacy)]]);
const migrated = boot({ saved });
assert.equal(migrated.run('CampaignStore.data.campaign.name'), legacy.campaign.name);
assert.equal(JSON.parse(saved.get(key)).version, 2);
assert.equal(migrated.run('activeArmy().units[0].reinforced'), false);
assert.deepEqual(JSON.parse(migrated.run('JSON.stringify(activeArmy().units.map(unit => unit.type))')), ['War Machine', 'Other', 'Other']);

const external = JSON.parse(saved.get(key));
external.campaign.name = 'Edited in another tab';
saved.set(key, JSON.stringify(external));
migrated.events.get('storage')({ key, newValue: saved.get(key) });
assert.equal(migrated.run('CampaignStore.data.campaign.name'), external.campaign.name);
saved.set(key, JSON.stringify({ ...external, sample: false }));
assert.equal(migrated.run('CampaignStore.save()'), false);
assert.equal(migrated.run('CampaignStore.conflict'), true);
assert.equal(JSON.parse(saved.get(key)).sample, false);

console.log('Passed script startup, six screens, dropdowns, Anvil heroes, datacards, reinforcement, and storage checks.');
