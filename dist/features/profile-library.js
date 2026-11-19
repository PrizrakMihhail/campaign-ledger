'use strict';

let libraryFilters;

function viewProfileLibrary(reset = false) {
  if (reset || !libraryFilters) {
    libraryFilters = { group: BattleCatalogue.groupName(activeArmy()?.faction) || 'Khazalite Holds', query: '' };
  }
  viewDialog('Unit profile library', `<style>${datacardStyles}</style>
    <p class="meta">Battle Profiles · ${escape(BattleCatalogue.edition)}. Datacards link to the matching warscroll source where available.</p>
    <div class="filter-row">${field('Search units', 'catalogue-query', libraryFilters.query, { type: 'search' })}${select('Faction or collection', 'catalogue-group', BattleCatalogue.groups, libraryFilters.group)}</div>
    <div id="catalogue-results"></div>`, '', true);
  const results = dialog.querySelector('#catalogue-results');
  const query = dialog.querySelector('#field-catalogue-query');
  const group = dialog.querySelector('#field-catalogue-group');
  const refresh = () => {
    libraryFilters = { group: group.value, query: query.value };
    results.innerHTML = libraryResults(libraryFilters);
  };
  query.addEventListener('input', refresh);
  group.addEventListener('change', refresh);
  refresh();
}

function libraryResults({ group, query }) {
  const term = query.trim().toLowerCase();
  const units = BattleCatalogue.list(group).filter(entry => entry.name.toLowerCase().includes(term));
  const rows = units.map(entry => `<tr>
    <td>${escape(entry.name)}${entry.kind ? `<span class="meta row-sub">${escape(entry.kind)}</span>` : ''}</td>
    <td>${fmt(entry.points)}</td><td>${modelCount(entry.size)}</td>
    <td>${button('View', 'view-catalogue-datacard', { id: entry.id, type: 'link', title: `View ${entry.name} datacard` })}</td></tr>`).join('');
  const references = group === 'Khazalite Holds' ? WarbandProfiles.references.filter(profile => profile.name.toLowerCase().includes(term)) : [];
  if (!rows && !references.length) return empty('No matching units', 'Try a different name or faction.');
  return `${rows ? `<div class="table-scroll"><table><thead><tr><th scope="col">Unit</th><th scope="col">Points</th><th scope="col">Unit size</th><th scope="col">Datacard</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}
    ${references.length ? `<section class="stack" style="margin-top:17px"><h3>Manifestations and faction terrain</h3><div class="dc-cards">${references.map(profile => datacard(profile)).join('')}</div></section>` : ''}`;
}

function viewCatalogueDatacard(id) {
  const entry = BattleCatalogue.get(id);
  if (!entry) return;
  viewDialog(`${entry.name} datacard`, `<style>${datacardStyles}</style><div class="dc-cards">${datacard(catalogueProfile(entry), null, null, entry)}</div>`, button('Back to profile library', 'back-to-profile-library'));
}
