'use strict';

const unitRenown = (warband, unit, battles) => unit.renown + Ledger.battleRenown({ battles }, warband.id, unit.id);
const unitWarscroll = unit => unit.warscroll?.trim() || unit.name?.trim();
function unitCatalogueEntry(warband, unit) {
  const name = unitWarscroll(unit);
  const canonical = BattleCatalogue.groupName(warband.faction) === 'Khazalite Holds' ? WarbandProfiles.find(name)?.name : undefined;
  return BattleCatalogue.find(warband.faction, canonical || name);
}
const catalogueProfile = entry => entry.profile || (entry.faction === 'Khazalite Holds' ? WarbandProfiles.find(entry.name) : undefined);
function referenceUnitProfile(warband, unit, entry) {
  if (entry) return catalogueProfile(entry);
  if (BattleCatalogue.groupName(warband.faction) === 'Khazalite Holds') return WarbandProfiles.find(unitWarscroll(unit));
}

function unitProfile(warband, unit, entry) {
  const reference = referenceUnitProfile(warband, unit, entry);
  const edits = unit.profileEdits;
  if (!edits) return reference;
  return { ...reference, ...edits.stats, melee: edits.melee ?? reference?.melee, ranged: edits.ranged ?? reference?.ranged,
    abilityDetails: Ledger.profileAbilityEdits(reference, edits) ?? reference?.abilityDetails, customized: true };
}
