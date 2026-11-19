'use strict';

const BattleCatalogue = (() => {
  const key = value => (value ?? '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
  const entries = BattleCatalogueData.entries.map((entry, index) => ({ ...entry, id: String(index) }));
  const allGroups = [...new Set(entries.map(entry => entry.faction))].sort((a, b) => a.localeCompare(b));
  const factions = allGroups.filter(group => group !== 'White Dwarf');
  const groupNames = new Map(allGroups.map(group => [key(group), group]));
  const byGroup = new Map(allGroups.map(group => [group, []]));
  const byName = new Map();
  for (const entry of entries) {
    const lookup = `${key(entry.faction)}:${key(entry.name)}`;
    byGroup.get(entry.faction).push(entry);
    byName.set(lookup, byName.has(lookup) ? null : entry);
  }
  for (const list of byGroup.values()) list.sort((a, b) => a.name.localeCompare(b.name));

  return {
    edition: BattleCatalogueData.edition,
    warscrollDate: BattleCatalogueData.warscrollDate,
    factions,
    groups: allGroups,
    groupName: value => groupNames.get(key(value)),
    list: value => byGroup.get(groupNames.get(key(value))) ?? [],
    find: (faction, name) => byName.get(`${key(faction)}:${key(name)}`),
    get: id => entries[Number(id)],
  };
})();
