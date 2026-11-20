'use strict';

const BattleCatalogue = (() => {
  const key = value => (value ?? '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
  // Deployment data replaces matching bundled records, while unmatched bundled
  // profiles remain available for custom and legacy campaign factions.
  const merged = new Map();
  for (const entry of [...BattleCatalogueData.entries, ...WahapediaCatalogueData.entries]) {
    merged.set(`${key(entry.faction)}:${key(entry.name)}:${key(entry.kind)}`, entry);
  }
  const entries = [...merged.values()].map((entry, index) => ({ ...entry, id: String(index) }));
  const allGroups = [...new Set(entries.map(entry => entry.faction))].sort((a, b) => a.localeCompare(b));
  const factions = allGroups.filter(group => !['White Dwarf', 'Endless Spells'].includes(group));
  const groupNames = new Map(allGroups.map(group => [key(group), group]));
  const byGroup = new Map(allGroups.map(group => [group, []]));
  const byName = new Map();
  const rulesByGroup = new Map(Object.entries(WahapediaCatalogueData.rules || {}).map(([group, rules]) => [key(group), rules]));
  for (const entry of entries) {
    byGroup.get(entry.faction).push(entry);
    for (const name of new Set([entry.name, ...(entry.aliases || [])].map(key))) {
      const lookup = `${key(entry.faction)}:${name}`;
      byName.set(lookup, byName.has(lookup) ? null : entry);
    }
  }
  for (const list of byGroup.values()) list.sort((a, b) => a.name.localeCompare(b.name));

  return {
    edition: WahapediaCatalogueData.entries.length ? WahapediaCatalogueData.edition : BattleCatalogueData.edition,
    warscrollDate: WahapediaCatalogueData.warscrollDate || BattleCatalogueData.warscrollDate,
    factions,
    groups: allGroups,
    groupName: value => groupNames.get(key(value)),
    list: value => [...(byGroup.get(groupNames.get(key(value))) ?? []), ...(key(value) === key('Endless Spells') ? [] : (byGroup.get('Endless Spells') ?? []).filter(entry => entry.category === 'Manifestation'))],
    find: (faction, name) => byName.get(`${key(faction)}:${key(name)}`) ?? byName.get(`${key('Endless Spells')}:${key(name)}`),
    get: id => entries[Number(id)],
    rules: faction => rulesByGroup.get(key(faction)),
    formations: faction => rulesByGroup.get(key(faction))?.battleFormations?.map(formation => formation.name) ?? [],
    lores: (faction, kind) => [...(rulesByGroup.get(key(faction))?.lores?.[kind] ?? []), ...(kind === 'manifestation' && key(faction) !== key('Endless Spells') ? rulesByGroup.get(key('Endless Spells'))?.lores?.manifestation ?? [] : [])],
  };
})();
