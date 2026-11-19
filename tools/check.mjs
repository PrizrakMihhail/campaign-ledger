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
assert.match(app.run('profileEditorFields(true)'), /Add Path upgrade/);
app.run('viewWarbandDatacards(activeArmy(), checkedUnit)');
assert.match(app.elements.get('#dialog').innerHTML, /Test Path upgrade/);

const legacy = JSON.parse(app.run('JSON.stringify(Ledger.sample())'));
legacy.version = 1;
legacy.campaign.name = 'Migration example';
delete legacy.armies[0].units[0].profileEdits;
const key = 'ptg_campaign_ledger_v2';
const saved = new Map([['ptg_campaign_ledger_v1', JSON.stringify(legacy)]]);
const migrated = boot({ saved });
assert.equal(migrated.run('CampaignStore.data.campaign.name'), legacy.campaign.name);
assert.equal(JSON.parse(saved.get(key)).version, 2);

const external = JSON.parse(saved.get(key));
external.campaign.name = 'Edited in another tab';
saved.set(key, JSON.stringify(external));
migrated.events.get('storage')({ key, newValue: saved.get(key) });
assert.equal(migrated.run('CampaignStore.data.campaign.name'), external.campaign.name);
saved.set(key, JSON.stringify({ ...external, sample: false }));
assert.equal(migrated.run('CampaignStore.save()'), false);
assert.equal(migrated.run('CampaignStore.conflict'), true);
assert.equal(JSON.parse(saved.get(key)).sample, false);

console.log('Passed script startup, asset paths, six screens, datacard export, backup migration, and cross-tab storage checks.');
