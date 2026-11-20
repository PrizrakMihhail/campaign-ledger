'use strict';

const cardFacts = pairs => pairs.filter(([, value]) => value !== '' && value != null)
  .map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('');

function weaponProfiles(title, rows, ranged = false) {
  if (!rows?.length) return '';
  const columns = (ranged ? [['Rng', 'Range']] : []).concat([['Atk', 'Attacks'], ['Hit', 'Hit'], ['Wnd', 'Wound'], ['Rnd', 'Rend'], ['Dmg', 'Damage']]);
  const head = columns.map(([label, full]) => `<th scope="col" aria-label="${full}">${label}</th>`).join('');
  const body = rows.map(([name, ...values]) => {
    const ability = values[columns.length];
    return `<tr><th scope="row">${escape(name)}${ability ? `<small>${escape(ability)}</small>` : ''}</th>${values.slice(0, columns.length).map(value => `<td>${escape(value)}</td>`).join('')}</tr>`;
  }).join('');
  return `<table class="dc-weapons"><caption>${title}</caption><thead><tr><th scope="col">Weapon</th>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function printChoice(label, name) {
  return `<label class="dc-print-choice"><input type="checkbox" checked aria-label="${escape(`${label}: ${name}`)}"> ${label}</label>`;
}

function abilityCard(ability, printControls) {
  const timing = ability.timing || '';
  const phase = timing.toLowerCase().match(/\b(hero|movement|shooting|charge|combat|deployment|passive|end)\b/)?.[1] || '';
  return `<section class="dc-ability" data-phase="${phase}">
    ${printControls ? printChoice('Print ability', ability.name) : ''}
    ${timing ? `<p class="dc-timing">${escape(timing)}</p>` : ''}
    <h3>${escape(ability.name)}</h3>
    ${ability.kind === 'Path upgrade' ? '<p class="dc-upgrade">Path upgrade</p>' : ''}
    ${ability.effect ? `<p class="dc-effect">${escape(ability.effect)}</p>` : ''}
  </section>`;
}

function profileContent(profile, printControls) {
  if (!profile) return '';
  const stats = cardFacts([...Object.entries(Ledger.profileStats).map(([key, label]) => [label, profile[key]]), ['Banishment', profile.banishment], ['Summon', profile.summon]]);
  const abilities = profile.abilityDetails?.map(ability => abilityCard(ability, printControls)).join('');
  const reference = profile.url ? `<a href="${escape(profile.url)}" target="_blank" rel="noopener noreferrer">Wahapedia warscroll</a> · ${profile.retrieved ? 'Retrieved ' + escape(profile.retrieved) : escape(BattleCatalogue.warscrollDate)}` : profile.page ? `${escape(WarbandProfiles.source)} · p. ${profile.page}` : '';
  return `${stats ? `<dl class="dc-stats">${stats}</dl>` : ''}${weaponProfiles('Ranged weapons', profile.ranged, true)}${weaponProfiles('Melee weapons', profile.melee)}
    ${abilities ?? (profile.abilities?.length ? `<section class="dc-detail"><h3>Ability reference</h3><p>${profile.abilities.map(escape).join(' · ')}</p></section>` : '')}
    ${profile.keywords?.length ? `<section class="dc-detail"><h3>Keywords</h3><p>${profile.keywords.map(escape).join(' · ')}</p></section>` : ''}
    ${profile.customized || reference ? `<p class="dc-source">${profile.customized ? 'Customized profile' : ''}${profile.customized && reference ? ' · Base profile from ' : ''}${reference}</p>` : ''}`;
}

function datacard(profile, unit, renown, entry, { printControls = false, warlord = false } = {}) {
  const name = unit?.name || entry?.name || profile.name;
  const category = unit ? Ledger.unitType(unit.type) : profile?.category || entry?.category;
  const points = unit ? Ledger.unitPoints(unit) : entry?.points;
  const size = unit ? Ledger.unitSize(unit, entry?.size) : entry?.size;
  const metrics = cardFacts([['Points', points === undefined ? '' : fmt(points)], ['Models', size ? fmt(size) : ''], ['Renown', unit ? fmt(renown) : '']]);
  const metainfo = unit ? cardFacts([['Warscroll', unit.warscroll || (profile?.name !== name ? profile?.name : '')], ['Rank', unit.rank], ['Path', unit.path]]) : '';
  const scarred = unit?.status === 'Scarred' || unit?.battleScars?.length > 0;
  const details = unit ? [['Enhancements and abilities', unit.enhancements], ['Battle Scars', unit.battleScars?.join(', ')], ['Scars and injuries', unit.scars], ['Unit notes', unit.notes]]
    .filter(([, value]) => value?.trim()).map(([label, value]) => `<section class="dc-detail"><h3>${label}</h3><p>${escape(value)}</p></section>`).join('') : '';
  return `<article class="datacard">
    <header class="dc-title"><div><p class="dc-label">${[category, entry?.kind, unit?.reinforced ? 'Reinforced' : ''].filter(Boolean).map(escape).join(' · ')}</p><h2>${escape(name)}</h2></div>
    ${warlord || scarred ? `<div class="dc-badges">${warlord ? '<span class="dc-status dc-warlord">Warlord</span>' : ''}${scarred ? '<span class="dc-status">Scarred</span>' : ''}</div>` : ''}</header>
    ${printControls ? printChoice('Print card', name) : ''}
    ${metrics ? `<dl class="dc-metrics">${metrics}</dl>` : ''}
    ${profileContent(profile, printControls)}
    ${anvilCard(unit?.anvil)}
    ${metainfo ? `<dl class="dc-details">${metainfo}</dl>` : ''}${details}
    ${entry ? `<p class="dc-source">Battle Profiles · ${escape(BattleCatalogue.edition)} · p. ${entry.page}</p>` : ''}</article>`;
}

function hasWarbandDatacards(warband) {
  return Boolean(warband && (warband.units.some(Ledger.battleReady) || warband.lores?.some(lore => lore.entries.length)));
}

function loreDatacard(lore, entry, printControls) {
  const labels = loreLabels[lore.kind];
  return `<article class="datacard dc-lore-card" data-lore="${escape(lore.kind)}">
    <header class="dc-title"><div><p class="dc-label">${labels.title} · ${escape(lore.name)}</p><h2>${escape(entry.name)}</h2></div>
    ${entry.value ? `<span class="dc-status">${labels.value} ${escape(entry.value)}</span>` : ''}</header>
    ${printControls ? printChoice('Print card', entry.name) : ''}
    ${[['Declare', entry.declare], ['Effect', entry.effect]].filter(([, value]) => value).map(([label, value]) =>
      `<section class="dc-detail"><h3>${label}</h3><p>${escape(value)}</p></section>`).join('')}
    </article>`;
}

function warbandCardList(warband, battles, { unit, printControls = false } = {}) {
  const warlordId = Ledger.warlord(warband)?.id;
  const units = unit ? [unit] : Ledger.sortedUnits(warband.units.filter(Ledger.battleReady), warlordId);
  const cards = units.map(unit => {
    const entry = unitCatalogueEntry(warband, unit);
    return datacard(unitProfile(warband, unit, entry), unit, unitRenown(warband, unit, battles), entry, { printControls, warlord: unit.id === warlordId });
  });
  if (!unit) {
    for (const kind of Ledger.loreKinds) {
      for (const lore of (warband.lores ?? []).filter(lore => lore.kind === kind)) {
        for (const entry of lore.entries) cards.push(loreDatacard(lore, entry, printControls));
      }
    }
  }
  return `<div class="dc-cards">${cards.join('\n')}</div>`;
}

function viewWarbandDatacards(warband, unit) {
  if (unit?.status === 'Retired') return;
  viewDialog(unit ? `${unit.name} datacard` : `${warband.name} datacards`,
    `<style>${datacardStyles}</style>${warbandCardList(warband, CampaignStore.data.battles, { unit })}`,
    hasWarbandDatacards(warband) ? button('Export warband HTML', 'export-datacards', { glyph: 'download' }) : '', !unit);
}

function warbandDatacards(campaign, warband, battles) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(warband.name)} · Campaign datacards</title>
<style>${datacardStyles}${datacardExportStyles}</style></head>
<body>
<header class="masthead" style="--banner:${Ledger.validColor(warband.color)}"><div><p class="dc-label">Path to Glory · Campaign datacards</p><h1>${escape(warband.name)}</h1>
<p class="warband-facts">${[campaign.name, warband.faction, `${fmt(Ledger.points(warband))} roster points`, warband.archived ? 'Archived' : ''].filter(Boolean).map(escape).join(' · ')}</p></div>
<button type="button" onclick="window.print()">Print or save PDF</button></header>
<main aria-label="Warband datacards"><p class="dc-print-hint">Uncheck a card or ability to omit it from the printout.</p>${warbandCardList(warband, battles, { printControls: true })}</main></body></html>`;
}

function exportDatacards() {
  const warband = activeArmy();
  if (!hasWarbandDatacards(warband)) return;
  const slug = warband.name.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').slice(0, 72).replace(/^-|-$/g, '') || 'warband';
  downloadFile(`${slug}-datacards.html`, warbandDatacards(CampaignStore.data.campaign, warband, CampaignStore.data.battles), 'text/html;charset=utf-8');
  tell('Warband datacards downloaded.');
}
