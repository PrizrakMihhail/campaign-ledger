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

function datacard(profile, unit, renown, entry, printControls = false) {
  const name = unit?.name || entry?.name || profile.name;
  const category = profile?.category || entry?.category || unit.type;
  const points = unit?.points ?? entry?.points;
  const size = unit?.size ?? entry?.size;
  const metrics = cardFacts([['Points', points === undefined ? '' : fmt(points)], ['Models', size ? fmt(size) : ''], ['Renown', unit ? fmt(renown) : '']]);
  const metainfo = unit ? cardFacts([['Warscroll', unit.warscroll || (profile?.name !== name ? profile?.name : '')], ['Rank', unit.rank], ['Path', unit.path]]) : '';
  const details = unit ? [['Enhancements and abilities', unit.enhancements], ['Scars and injuries', unit.scars], ['Unit notes', unit.notes]]
    .filter(([, value]) => value?.trim()).map(([label, value]) => `<section class="dc-detail"><h3>${label}</h3><p>${escape(value)}</p></section>`).join('') : '';
  return `<article class="datacard"${unit?.status === 'Retired' ? ' data-retired' : ''}>
    <header class="dc-title"><div><p class="dc-label">${[category, entry?.kind].filter(Boolean).map(escape).join(' · ')}</p><h2>${escape(name)}</h2></div>${unit ? `<span class="dc-status">${escape(unit.status)}</span>` : ''}</header>
    ${printControls ? printChoice('Print card', name) : ''}
    ${metrics ? `<dl class="dc-metrics">${metrics}</dl>` : ''}
    ${profileContent(profile, printControls)}
    ${metainfo ? `<dl class="dc-details">${metainfo}</dl>` : ''}${details}
    ${entry ? `<p class="dc-source">Battle Profiles · ${escape(BattleCatalogue.edition)} · p. ${entry.page}</p>` : ''}</article>`;
}

const datacardStyles = `
  .dc-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 14px; align-items: start; }
  .dc-cards h2, .dc-cards h3, .dc-cards p, .dc-cards dl, .dc-cards dd { margin: 0; overflow-wrap: anywhere; }
  .dc-cards .datacard { color: #192d29; background: #fffefa; border: 1px solid #839087; border-top: 5px solid var(--banner, #49665c); border-radius: 6px; padding: 14px; min-width: 0; }
  .dc-title { display: flex; justify-content: space-between; flex-wrap: wrap; align-items: start; gap: 7px; }
  .dc-title > div { min-width: 0; }
  .dc-title h2 { margin-top: 2px; font: 700 1.43rem/1.16 Georgia, serif; }
  .dc-status { border: 1px solid #81948a; border-radius: 4px; padding: 3px 7px; font-size: .75rem; font-weight: 700; }
  [data-retired] .dc-status { border-color: #787878; color: #444; }
  .dc-label, .dc-cards dt, .dc-detail h3, .dc-weapons caption { font: 750 .74rem/1.2 system-ui, sans-serif; text-transform: uppercase; letter-spacing: .045em; color: #3d5a50; }
  .dc-cards .dc-stats, .dc-cards .dc-metrics { display: grid; gap: 5px; margin-top: 12px; }
  .dc-stats { grid-template-columns: repeat(auto-fit, minmax(min(100%, 72px), 1fr)); }
  .dc-metrics { grid-template-columns: repeat(auto-fit, minmax(min(100%, 72px), 1fr)); }
  .dc-stats > div, .dc-metrics > div { border: 1px solid #b6c4b8; background: #ecf2ea; border-radius: 4px; padding: 5px 6px; }
  .dc-stats dd, .dc-metrics dd { font: 700 1.23rem/1.15 Georgia, serif; margin-top: 3px; }
  .dc-weapons { width: 100%; border-collapse: collapse; text-align: left; margin-top: 11px; font: .83rem/1.2 system-ui, sans-serif; }
  .dc-weapons caption { text-align: left; padding-bottom: 5px; }
  .dc-weapons th, .dc-weapons td { border: 1px solid #c6d0c5; padding: 4px; font-size: inherit; color: inherit; }
  .dc-weapons thead th { background: #ecf2ea; }
  .dc-weapons th:first-child { width: 100%; overflow-wrap: anywhere; }
  .dc-weapons td { text-align: center; white-space: nowrap; }
  .dc-weapons small { display: block; font-size: .72rem; font-weight: 500; }
  .dc-details { display: flex; flex-wrap: wrap; gap: 8px 15px; padding-top: 10px; font-size: .9rem; }
  .dc-detail { border-top: 1px solid #c6d0c5; padding-top: 7px; margin-top: 9px; }
  .dc-detail p { white-space: pre-wrap; margin-top: 3px; line-height: 1.36; font-size: .88rem; }
  .dc-ability { --phase-ink: #39574a; border: 1px solid #c6d0c5; border-inline-start: 3px solid var(--phase-ink); border-radius: 4px; padding: 8px 10px; margin-top: 10px; }
  .dc-ability[data-phase="shooting"], .dc-ability[data-phase="movement"] { --phase-ink: #285a76; }
  .dc-ability[data-phase="charge"], .dc-ability[data-phase="combat"] { --phase-ink: #813d31; }
  .dc-ability[data-phase="hero"], .dc-ability[data-phase="end"] { --phase-ink: #645081; }
  .dc-ability .dc-timing { color: var(--phase-ink); font-size: .76rem; font-weight: 750; margin-bottom: 3px; }
  .dc-ability h3 { font: 700 1rem/1.2 Georgia, serif; }
  .dc-ability .dc-upgrade { display: inline-block; border: 1px solid #a39777; color: #574824; border-radius: 3px; padding: 1px 4px; font-size: .74rem; margin-top: 5px; }
  .dc-ability .dc-effect { white-space: pre-wrap; margin-top: 5px; line-height: 1.36; font-size: .88rem; }
  .dc-cards .dc-source { font-size: .75rem; color: #3d5a50; margin-top: 8px; }
  .dc-source a { color: #244e40; text-decoration: underline; }
`;

function warbandCardList(warband, battles, { units = warband.units, printControls = false } = {}) {
  const cards = units.map(unit => {
    const entry = unitCatalogueEntry(warband, unit);
    return datacard(unitProfile(warband, unit, entry), unit, unitRenown(warband, unit, battles), entry, printControls);
  }).join('\n');
  return `<div class="dc-cards" style="--banner:${Ledger.validColor(warband.color)}">${cards}</div>`;
}

function viewWarbandDatacards(warband, unit) {
  viewDialog(unit ? `${unit.name} datacard` : `${warband.name} datacards`,
    `<style>${datacardStyles}</style>${warbandCardList(warband, CampaignStore.data.battles, { units: unit ? [unit] : warband.units })}`,
    button('Export warband HTML', 'export-datacards', { glyph: 'download' }), !unit);
}

function warbandDatacards(campaign, warband, battles) {

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(warband.name)} · Campaign datacards</title>
<style>
  * { box-sizing: border-box; }
  :root { font-family: system-ui, sans-serif; color: #192d29; background: #eef1ea; }
  body { max-width: 1060px; margin: auto; padding: clamp(16px, 4vw, 44px); }
  h1, p { margin: 0; overflow-wrap: anywhere; }
  h1 { font-family: Georgia, serif; }
  .masthead { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 14px; padding: 0 0 19px; margin-bottom: 20px; border-bottom: 2px solid #48645b; }
  .masthead h1 { font-size: clamp(1.9rem, 5vw, 3.1rem); margin: 4px 0 6px; }
  .warband-facts { color: #354a42; line-height: 1.5; }
  button { align-self: start; font: inherit; font-weight: 650; color: #fff; padding: 9px 14px; border: 1px solid #25493f; border-radius: 5px; background: #25493f; cursor: pointer; }
  button:focus-visible { outline: 2px solid #25493f; outline-offset: 3px; }
  ${datacardStyles}
  .dc-print-hint { color: #354a42; margin-bottom: 14px; }
  .dc-print-choice { display: flex; align-items: center; gap: 6px; width: fit-content; margin: 6px 0; font-size: .8rem; }
  .dc-print-choice input { accent-color: #25493f; margin: 0; width: 16px; height: 16px; }
  .dc-ability > .dc-print-choice { float: inline-end; margin: 0 0 4px 8px; }
  :is(.datacard, .dc-ability):has(> .dc-print-choice input:not(:checked)) { border-style: dashed; }
  @page { margin: 11mm; }
  @media print {
    :root, .dc-cards .datacard, .dc-stats > div, .dc-metrics > div { background: white; }
    body { max-width: none; padding: 0; font-size: 10pt; }
    button, .dc-print-choice, .dc-print-hint, :is(.datacard, .dc-ability):has(> .dc-print-choice input:not(:checked)) { display: none; }
    .masthead { break-inside: avoid; margin-bottom: 4mm; padding-bottom: 3mm; }
    .masthead h1 { font-size: 22pt; }
    .dc-cards { display: block; column-count: 2; column-gap: 4mm; }
    .dc-cards .datacard { break-inside: avoid; margin: 0 0 4mm; padding: 3mm; }
    .dc-ability { break-inside: avoid; }
    .dc-title h2 { font-size: 15pt; }
  }
</style></head>
<body>
<header class="masthead"><div><p class="dc-label">Path to Glory · Campaign datacards</p><h1>${escape(warband.name)}</h1>
<p class="warband-facts">${[campaign.name, warband.faction, warband.warlord ? `Warlord ${warband.warlord}` : '', `${fmt(Ledger.points(warband))} roster points`, warband.archived ? 'Archived' : ''].filter(Boolean).map(escape).join(' · ')}</p></div>
<button type="button" onclick="window.print()">Print or save PDF</button></header>
<main aria-label="Unit datacards"><p class="dc-print-hint">Uncheck a card or ability to omit it from the printout.</p>${warbandCardList(warband, battles, { printControls: true })}</main></body></html>`;
}

function exportDatacards() {
  const warband = activeArmy();
  if (!warband?.units.length) return;
  const slug = warband.name.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').slice(0, 72).replace(/^-|-$/g, '') || 'warband';
  downloadFile(`${slug}-datacards.html`, warbandDatacards(CampaignStore.data.campaign, warband, CampaignStore.data.battles), 'text/html;charset=utf-8');
  tell('Warband datacards downloaded.');
}
