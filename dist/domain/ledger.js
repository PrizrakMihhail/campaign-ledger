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
  const unitTypes = Object.freeze(['Hero', 'Infantry', 'Cavalry', 'War Machine', 'Monster', 'Terrain', 'Other']);
  const unitTypeNames = new Map([...unitTypes.map(type => [type.toLowerCase(), type]), ['artillery', 'War Machine'], ['faction terrain', 'Terrain']]);
  const profileStats = Object.freeze({ move: 'Move', health: 'Health', save: 'Save', control: 'Control', ward: 'Ward' });
  const weaponFields = ranged => [...(ranged ? ['Range'] : []), 'Attacks', 'Hit', 'Wound', 'Rend', 'Damage', 'Weapon traits'];
  const validColor = value => /^#[a-f\d]{6}$/i.test(value) ? value : '#bd8e58';
  const str = value => typeof value === 'string' ? value : '';
  const unitType = value => unitTypeNames.get(str(value).trim().toLowerCase()) ?? 'Other';
  const unitNameOrder = new Intl.Collator(undefined, { sensitivity: 'base' });
  const unitName = unit => str(unit.name).trim() || str(unit.warscroll).trim() || 'Unnamed unit';
  const warlord = army => army.units.find(unit => unit.id === army.warlordId && unitType(unit.type) === 'Hero');
  const sortedUnits = (units, warlordId) => [...units].sort((a, b) =>
    Number(b.id === warlordId && Boolean(warlordId)) - Number(a.id === warlordId && Boolean(warlordId)) ||
    unitTypes.indexOf(unitType(a.type)) - unitTypes.indexOf(unitType(b.type)) || unitNameOrder.compare(unitName(a), unitName(b)));
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

  function normalizeAnvil(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const limit = value.limit == null || value.limit === '' ? null : integer(value.limit, null);
    const choices = Array.isArray(value.choices) ? value.choices : [];
    return {
      rules: str(value.rules).trim(),
      limit: limit >= 0 ? limit : null,
      choices: choices.filter(row => str(row?.name).trim()).map(row => ({
        stage: str(row.stage).trim(), name: row.name.trim(), cost: integer(row.cost), notes: str(row.notes).trim(),
      })),
    };
  }

  const destinySpent = anvil => anvil.choices.reduce((total, choice) => total + choice.cost, 0);

  const loreKinds = ['spell', 'prayer', 'manifestation'];

  function normalizeLore(lore) {
    return {
      kind: choice(lore.kind, loreKinds, 'spell'),
      name: str(lore.name) || 'Unnamed lore',
      points: Math.max(0, integer(lore.points)),
      entries: records(lore.entries, entry => ({
        name: str(entry.name) || 'Unnamed entry',
        declare: str(entry.declare ?? entry.timing), value: str(entry.value), effect: str(entry.effect),
      })),
    };
  }

  function normalizeUnit(unit) {
    const anvil = normalizeAnvil(unit.anvil);
    return {
      name: unitName(unit), warscroll: str(unit.warscroll), type: anvil ? 'Hero' : unitType(unit.type),
      points: Math.max(0, integer(unit.points)), size: Math.max(0, integer(unit.size)) || null, renown: integer(unit.renown),
      rank: str(unit.rank), path: str(unit.path), reinforced: unit.reinforced === true,
      status: choice(unit.status, unitStatuses, 'Active'), enhancements: str(unit.enhancements), scars: str(unit.scars), notes: str(unit.notes),
      profileEdits: normalizeProfileEdits(unit.profileEdits), anvil,
    };
  }

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
      name: str(a.name) || 'Unnamed warband', faction: str(a.faction), warlord: str(a.warlord), warlordId: a.warlordId == null ? null : str(a.warlordId),
      notes: str(a.notes), color: validColor(a.color), archived: a.archived === true,
      units: records(a.units, normalizeUnit),
      lores: records(a.lores, normalizeLore),
      quests: records(a.quests, q => ({
        title: str(q.title) || 'Unnamed quest', goal: str(q.goal), status: choice(q.status, questStatuses, 'Active'),
        reward: str(q.reward), notes: str(q.notes), target: Math.max(0, integer(q.target)), progress: Math.max(0, integer(q.progress)),
      })),
      ledger: records(a.ledger, l => ({ date: cleanDate(l.date), reason: str(l.reason), delta: integer(l.delta) })),
    }));
    for (const army of armies) {
      if (army.warlordId === null && army.warlord.trim()) {
        const matches = army.units.filter(unit => unit.type === 'Hero' && unitName(unit) === army.warlord.trim());
        if (matches.length === 1) army.warlordId = matches[0].id;
      }
      army.warlordId = warlord(army)?.id ?? '';
    }
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

  function normalizeProfileEdits(value = {}) {
    const edits = {};
    const stats = Object.fromEntries(Object.keys(profileStats).filter(key => typeof value?.stats?.[key] === 'string').map(key => [key, value.stats[key].trim()]));
    if (Object.keys(stats).length) edits.stats = stats;
    for (const kind of ['melee', 'ranged']) {
      if (Array.isArray(value?.[kind])) {
        edits[kind] = value[kind].filter(row => Array.isArray(row) && str(row[0]).trim())
          .map(row => Array.from({ length: weaponFields(kind === 'ranged').length + 1 }, (_, index) => str(row[index]).trim()));
      }
    }
    if (Array.isArray(value?.abilities)) {
      edits.abilities = value.abilities.filter(row => str(row?.name).trim()).map(row => ({
        name: row.name.trim(), timing: str(row.timing).trim(), effect: str(row.effect).trim(), kind: row.kind === 'Path upgrade' ? 'Path upgrade' : 'Ability',
      }));
      if (value.abilityDetailsVersion === 1) edits.abilityDetailsVersion = 1;
    }
    return Object.keys(edits).length ? edits : null;
  }

  function profileDefaults(profile) {
    const stats = Object.fromEntries(Object.keys(profileStats).map(key => [key, profile?.[key] || '']));
    const lists = normalizeProfileEdits({ melee: profile?.melee || [], ranged: profile?.ranged || [],
      abilities: profile?.abilityDetails ?? (profile?.abilities || []).map(name => ({ name })) });
    return { stats, ...lists };
  }

  function profileAbilityEdits(profile, edits) {
    if (!edits?.abilities || edits.abilityDetailsVersion === 1 || !profile?.abilityDetails) return edits?.abilities;
    const key = name => name.toLowerCase().trim();
    const reference = new Map(profile.abilityDetails.map(ability => [key(ability.name), ability]));
    return edits.abilities.map(ability => {
      const original = ability.kind === 'Path upgrade' ? undefined : reference.get(key(ability.name));
      return original ? { ...ability, timing: ability.timing || original.timing, effect: ability.effect || original.effect } : ability;
    });
  }

  function profileChanges(base, draft) {
    const edits = { stats: Object.fromEntries(Object.entries(draft.stats).filter(([key, value]) => value !== base.stats[key])) };
    for (const kind of ['melee', 'ranged', 'abilities']) {
      if (JSON.stringify(draft[kind]) !== JSON.stringify(base[kind])) edits[kind] = draft[kind];
    }
    if (edits.abilities) edits.abilityDetailsVersion = 1;
    return edits;
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

  const unitMultiplier = unit => unit.reinforced === true ? 2 : 1;
  const unitPoints = unit => unit.points * unitMultiplier(unit);
  const unitSize = (unit, catalogueSize = null) => {
    const baseSize = unit.size ?? catalogueSize;
    return baseSize === null ? null : baseSize * unitMultiplier(unit);
  };
  const lorePoints = army => (army.lores ?? []).reduce((sum, lore) => sum + lore.points, 0);
  const points = army => army.units.reduce((sum, unit) => sum + (unit.status === 'Retired' ? 0 : unitPoints(unit)), lorePoints(army));
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

  return { packs, resultOptions, unitStatuses, questStatuses, unitTypes, unitType, unitName, warlord, sortedUnits, profileStats, weaponFields, normalizeProfileEdits, profileDefaults, profileAbilityEdits, profileChanges, validColor, integer, id, date, dateOrder,
    blank, normalize, normalizeAnvil, destinySpent, sample, unitPoints, unitSize, loreKinds, lorePoints, points, participants, signed, balance, transactions, unitHistory, battleRenown, record, resultFor };
})();
