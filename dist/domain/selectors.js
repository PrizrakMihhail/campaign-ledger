'use strict';

const army = key => CampaignStore.data.armies.find(item => item.id === key);
const activeArmy = () => army(CampaignStore.data.activeWarbandId);
let viewedArmyId = '';
const viewedArmy = () => army(viewedArmyId) || activeArmy();
const warbandBattles = warband => warband ? CampaignStore.data.battles
  .filter(battle => Ledger.participants(battle).includes(warband.id)).sort(Ledger.dateOrder) : [];

function armyOptions(list = CampaignStore.data.armies) {
  return list.map(a => [a.id, `${a.name}${a.archived ? ' (archived)' : ''}`]);
}
