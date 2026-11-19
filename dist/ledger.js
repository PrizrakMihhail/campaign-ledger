'use strict';

const Ledger = (() => {
  const packs = new Map(Object.entries({
    Ascension: 'Glory Points',
    'Ravaged Coast': 'Emberstone Shards',
    'Blighted Wilds': 'Campaign Resources',
    'The Grymmpeaks': 'Chamonite Ore Points',
    Custom: 'Campaign Resources',
  }));
  const resultOptions = ['Victory', 'Defeat', 'Draw', 'Other'];
  const unitStatuses = ['Active', 'Scarred', 'Retired'];
  const questStatuses = ['Active', 'Completed', 'Abandoned'];
  const categories = ['Hero', 'Infantry', 'Cavalry', 'Artillery', 'Monster', 'Construct', 'Other'];
  const validColor = value => /^#[a-f\d]{6}$/i.test(value) ? value : '#bd8e58';
  const str = value => typeof value === 'string' ? value : '';
  const integer = (value, fallback = 0) => Number.isSafeInteger(Number(value)) ? Number(value) : fallback;
  const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const date = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const dateOrder = (a, b) => b.date.localeCompare(a.date);
  const cleanDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) ? value : '';
  const choice = (value, options, fallback) => options.includes(value) ? value : fallback;
  const records = (value, convert) => {
    const seen = new Set();
    return (Array.isArray(value) ? value : []).map(item => {
      const key = str(item?.id);
      if (!key || seen.has(key)) throw new Error('The backup contains missing or duplicate record IDs.');
      seen.add(key);
      return { ...convert(item), id: key };
    });
  };

  function blank() {
    return {
      version: 2, sample: false, activeArmyId: '',
      campaign: { name: 'My Path to Glory', pack: 'Ascension', location: 'The Mortal Realms', resource: 'Glory Points', pointsLimit: 1000, notes: '' },
      armies: [], battles: [], entries: [],
    };
  }

  function normalize(value) {
    if (!value?.campaign || typeof value.campaign !== 'object' || Array.isArray(value.campaign) ||
        !Array.isArray(value.armies) || !Array.isArray(value.battles) || !Array.isArray(value.entries)) {
      throw new Error('Choose a Campaign Ledger JSON backup.');
    }
    if (value.version && ![1, 2].includes(value.version)) throw new Error('This backup uses an unsupported version.');
    const c = value.campaign;
    const armies = records(value.armies, a => ({
      name: str(a.name) || 'Unnamed warband', faction: str(a.faction), warlord: str(a.warlord),
      notes: str(a.notes), color: validColor(a.color), archived: a.archived === true,
      units: records(a.units, u => ({
        name: str(u.name) || 'Unnamed unit', warscroll: str(u.warscroll), type: str(u.type) || 'Other',
        points: Math.max(0, integer(u.points)), renown: integer(u.renown), rank: str(u.rank), path: str(u.path),
        status: choice(u.status, unitStatuses, 'Active'), enhancements: str(u.enhancements), scars: str(u.scars), notes: str(u.notes),
      })),
      quests: records(a.quests, q => ({
        title: str(q.title) || 'Unnamed quest', goal: str(q.goal), status: choice(q.status, questStatuses, 'Active'),
        reward: str(q.reward), notes: str(q.notes), target: Math.max(0, integer(q.target)), progress: Math.max(0, integer(q.progress)),
      })),
      ledger: records(a.ledger, l => ({ date: cleanDate(l.date), reason: str(l.reason), delta: integer(l.delta) })),
    }));
    const pack = str(c.pack) || 'Custom';
    return {
      version: 2, sample: value.sample === true,
      campaign: {
        name: str(c.name) || 'My Path to Glory', pack, location: str(c.location),
        resource: str(c.resource) || packs.get(pack) || packs.get('Custom'),
        pointsLimit: Math.max(1, integer(c.pointsLimit) || 1000), notes: str(c.notes),
      },
      activeArmyId: armies.some(a => a.id === value.activeArmyId) ? value.activeArmyId : armies[0]?.id || '',
      armies,
      battles: records(value.battles, b => ({
        title: str(b.title) || 'Unnamed battle', date: cleanDate(b.date), battleplan: str(b.battleplan),
        armyId: str(b.armyId), opponentArmyId: str(b.opponentArmyId), opponent: str(b.opponent),
        result: choice(b.result, resultOptions, 'Other'), notes: str(b.notes),
        delta: integer(b.delta), oppDelta: integer(b.oppDelta),
        awards: records(b.awards, a => ({ armyId: str(a.armyId), unitId: str(a.unitId), unitName: str(a.unitName), delta: integer(a.delta) })),
      })),
      entries: records(value.entries, j => ({ title: str(j.title) || 'Untitled entry', date: cleanDate(j.date), armyId: str(j.armyId), body: str(j.body) })),
    };
  }

  function sample() {
    return normalize({
      ...blank(), sample: true, activeArmyId: 'forge',
      campaign: {
        name: 'The Long Reckoning', pack: 'Ascension', location: 'The Ashen Marches', resource: 'Glory Points', pointsLimit: 1000,
        notes: 'Two rival warbands follow the old beacon road into the Ashen Marches. Whoever lights the final beacon will command the crossing.',
      },
      armies: [
        {
          id: 'forge', name: 'Forge of the Sunset', faction: 'Khazalite Holds', warlord: 'Dagna Emberhand', color: '#ca935d',
          notes: 'Dagna and her company seek the last surviving beacon of their ancestral hold.',
          units: [
            { id: 'dagna', name: 'Dagna Emberhand', type: 'Hero', points: 280, renown: 4, path: 'Path of the Warrior' },
            { id: 'oath', name: 'The Oathkeepers', type: 'Infantry', points: 300, renown: 2 },
            { id: 'flint', name: 'Flintguard', type: 'Infantry', points: 240, renown: 1, status: 'Scarred', scars: 'Still bearing wounds from the fight at the crossing.' },
          ],
          quests: [
            { id: 'beacons', title: 'Relight the Watchfires', goal: 'Secure three abandoned beacons along the old road.', reward: 'Control of the beacon road', target: 3, progress: 2 },
            { id: 'standard', title: 'Recover the Fallen Standard', goal: 'Find the company standard in the ruins of Cinderfall.', reward: 'The lost company banner' },
          ],
          ledger: [{ id: 'supply', date: '2026-10-04', reason: 'Supplies for the beacon road', delta: -2 }],
        },
        {
          id: 'veil', name: 'The Hollow Host', faction: 'Nighthaunt', warlord: 'The Veiled Marshal', color: '#8eaa98',
          units: [
            { id: 'marshal', name: 'The Veiled Marshal', type: 'Hero', points: 280, renown: 3 },
            { id: 'bound', name: 'The Oathbound Dead', type: 'Infantry', points: 460, renown: 2 },
          ],
        },
      ],
      battles: [
        { id: 'crossing', title: 'The Cinderfall Crossing', date: '2026-11-14', battleplan: 'Hold the Crossing', armyId: 'forge', opponentArmyId: 'veil', result: 'Victory', delta: 4, oppDelta: 2,
          notes: 'The Oathkeepers held the bridge long enough for Dagna to light the second beacon.',
          awards: [{ id: 'award-crossing', armyId: 'forge', unitId: 'oath', unitName: 'The Oathkeepers', delta: 2 }] },
        { id: 'gate', title: 'Siege of the Ember Gate', date: '2026-10-31', battleplan: 'The Broken Gate', armyId: 'forge', opponent: 'The Iron Maw', result: 'Draw', delta: 2 },
        { id: 'valley', title: 'Into the Ashen Vale', date: '2026-10-17', armyId: 'forge', opponentArmyId: 'veil', result: 'Defeat', delta: 2, oppDelta: 3 },
      ],
      entries: [{ id: 'entry', title: 'A Light on the Old Road', date: '2026-11-14', armyId: 'forge', body: 'The second beacon burned through the night. Even from the valley floor, Dagna could see the old road take shape in its light.' }],
    });
  }

  const points = army => army.units.reduce((sum, unit) => sum + (unit.status === 'Retired' ? 0 : unit.points), 0);
  const participants = battle => [battle.armyId, battle.opponentArmyId].filter(Boolean);
  const signed = value => value > 0 ? `+${value.toLocaleString()}` : value.toLocaleString();

  function balance(state, army) {
    return transactions(state, army).reduce((sum, entry) => sum + entry.delta, 0);
  }

  function transactions(state, army) {
    const entries = army.ledger.map(entry => ({ ...entry, manual: true }));
    for (const b of state.battles) {
      const delta = b.armyId === army.id ? b.delta : b.opponentArmyId === army.id ? b.oppDelta : 0;
      if (delta) entries.push({ id: b.id, date: b.date, reason: b.title, delta, manual: false });
    }
    return entries.sort(dateOrder);
  }

  function unitHistory(state, armyId, unitId) {
    return state.battles.flatMap(battle => battle.awards
      .filter(award => award.armyId === armyId && award.unitId === unitId)
      .map(award => ({ ...award, title: battle.title, date: battle.date, battleId: battle.id }))).sort(dateOrder);
  }

  function battleRenown(state, armyId, unitId) {
    return unitHistory(state, armyId, unitId).reduce((sum, award) => sum + award.delta, 0);
  }

  function record(state, armyId) {
    const counts = { Victory: 0, Defeat: 0, Draw: 0, Other: 0 };
    for (const b of state.battles.filter(battle => participants(battle).includes(armyId))) {
      counts[resultFor(b, armyId)]++;
    }
    return counts;
  }

  function resultFor(battle, armyId) {
    if (armyId && battle.opponentArmyId === armyId) {
      if (battle.result === 'Victory') return 'Defeat';
      if (battle.result === 'Defeat') return 'Victory';
    }
    return battle.result;
  }

  return { packs, resultOptions, unitStatuses, questStatuses, categories, validColor, integer, id, date, dateOrder,
    blank, normalize, sample, points, participants, signed, balance, transactions, unitHistory, battleRenown, record, resultFor };
})();
