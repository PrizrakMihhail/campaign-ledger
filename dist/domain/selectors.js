'use strict';

const army = key => CampaignStore.data.armies.find(item => item.id === key);
const activeArmy = () => army(CampaignStore.data.activeArmyId) || CampaignStore.data.armies[0];
const sortedBattles = () => [...CampaignStore.data.battles].sort(Ledger.dateOrder);

function armyOptions(list = CampaignStore.data.armies) {
  return list.map(a => [a.id, `${a.name}${a.archived ? ' (archived)' : ''}`]);
}
