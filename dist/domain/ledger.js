'use strict';

const Ledger = (() => {
  const packs = new Map(Object.entries({
    Ascension: '',
    'Ravaged Coast': 'Emberstone Shards',
    'Blighted Wilds': 'Campaign Resources',
    'The Grymmpeaks': 'Chamonite Ore Points',
    Custom: 'Campaign Resources',
  }));
  const gloryPoints = 'Glory Points';
  const resourceName = value => str(value).trim().toLowerCase() === gloryPoints.toLowerCase() ? '' : str(value).trim();
  const latestWarband = armies => armies.findLast(army => !army.archived);
  const resultOptions = ['Victory', 'Defeat', 'Draw', 'Other'];
  const unitStatuses = ['Active', 'In Reserves', 'Retired'];
  const firstScarCount = 5;
  const retirementScarCount = 18;
  const battleScarThresholds = [[retirementScarCount, 'Succumbed to injuries'], [13, 'Critical'], [9, 'Severe'], [firstScarCount, 'Serious']];
  const battleScarSeverity = count => battleScarThresholds.find(([minimum]) => count >= minimum)?.[1] ?? '-';
  const isScarred = unit => unit.battleScars >= firstScarCount && unit.battleScars < retirementScarCount;
  function battleReady(unit, armyId, battles) {
    const status = rosterStatus(unit, armyId, battles);
    return status !== 'In Reserves' && status !== 'Retired';
  }
  const questStatuses = ['Active', 'Completed', 'Forfeited'];
  const activeQuest = warband => warband?.quests.find(quest => quest.status === 'Active');
  const unitTypes = Object.freeze(['Hero', 'Infantry', 'Cavalry', 'War Machine', 'Monster', 'Terrain', 'Other', 'Manifestation']);
  const unitTypeNames = new Map([...unitTypes.map(type => [type.toLowerCase(), type]), ['artillery', 'War Machine'], ['faction terrain', 'Terrain']]);
  const profileStats = Object.freeze({ move: 'Move', health: 'Health', save: 'Save', control: 'Control', ward: 'Ward' });
  const weaponFields = ranged => [...(ranged ? ['Range'] : []), 'Attacks', 'Hit', 'Wound', 'Rend', 'Damage', 'Weapon traits'];
  const validColor = value => /^#[a-f\d]{6}$/i.test(value) ? value : '#bd8e58';
  const str = value => typeof value === 'string' ? value : '';
  const unitType = value => unitTypeNames.get(str(value).trim().toLowerCase()) ?? 'Other';
  const unitNameOrder = new Intl.Collator(undefined, { sensitivity: 'base' });
  const unitName = unit => str(unit.name).trim() || str(unit.warscroll).trim() || 'Unnamed unit';
  const warlord = army => army.units.find(unit => unit.id === army.warlordId && unitType(unit.type) === 'Hero');
  const sortedUnits = (units, warlordId, typeOf = unit => unitType(unit.type)) => [...units].sort((a, b) =>
    Number(b.id === warlordId && Boolean(warlordId)) - Number(a.id === warlordId && Boolean(warlordId)) ||
    unitTypes.indexOf(typeOf(a)) - unitTypes.indexOf(typeOf(b)) || unitNameOrder.compare(unitName(a), unitName(b)));
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

  function unitBattleStats(value) {
    return { kills: Math.max(0, integer(value.kills)), questPoints: Math.max(0, integer(value.questPoints)), dead: value.dead === true };
  }

  function unitStatus(status, battleScars) {
    return battleScars >= retirementScarCount ? 'Retired' : choice(status === 'In Reserve' ? 'In Reserves' : status, unitStatuses, 'Active');
  }

  function normalizeUnit(unit) {
    const anvil = normalizeAnvil(unit.anvil);
    const legacySeverity = Array.isArray(unit.battleScars)
      ? battleScarThresholds.slice(1).find(([, severity]) => unit.battleScars.includes(severity))?.[0]
      : undefined;
    const fallbackCount = unit.status === 'Scarred' ? firstScarCount : 0;
    const battleScars = Math.max(0, Array.isArray(unit.battleScars) ? legacySeverity ?? fallbackCount : integer(unit.battleScars ?? fallbackCount));
    return {
      name: unitName(unit), warscroll: str(unit.warscroll), type: anvil ? 'Hero' : unitType(unit.type),
      points: Math.max(0, integer(unit.points)), size: Math.max(0, integer(unit.size)) || null, renown: integer(unit.renown),
      rank: str(unit.rank), path: str(unit.path), reinforced: unit.reinforced === true,
      upgrades: (Array.isArray(unit.upgrades) ? unit.upgrades : []).filter(upgrade => str(upgrade?.name).trim()).map(upgrade => ({
        type: str(upgrade.type), name: str(upgrade.name), cost: Math.max(0, integer(upgrade.cost)), description: str(upgrade.description),
      })),
      status: unitStatus(unit.status, battleScars), enhancements: str(unit.enhancements), scars: str(unit.scars), notes: str(unit.notes),
      battleScars,
      profileEdits: normalizeProfileEdits(unit.profileEdits), anvil,
    };
  }

  function blank() {
    return {
      version: 3, activeWarbandId: '',
      campaign: { name: 'My Path to Glory', pack: 'Ascension', location: 'The Mortal Realms', resource: '', pointsLimit: 1000, notes: '' },
      armies: [], battles: [], entries: [],
    };
  }

  function normalize(value) {
    if (!value?.campaign || typeof value.campaign !== 'object' || Array.isArray(value.campaign) ||
        !Array.isArray(value.armies) || !Array.isArray(value.battles) || !Array.isArray(value.entries)) {
      throw new Error('Choose a Campaign Ledger JSON backup.');
    }
    if (value.version && ![1, 2, 3].includes(value.version)) throw new Error('This backup uses an unsupported version.');
    const c = value.campaign;
    const pack = str(c.pack) || 'Custom';
    const resource = resourceName(value.version === 3 ? c.resource : str(c.resource) || (packs.get(pack) ?? packs.get('Custom')));
    const legacyResource = value.version !== 3 && Boolean(resource);
    const armies = records(value.armies, a => ({
      name: str(a.name) || 'Unnamed warband', faction: str(a.faction), warlord: str(a.warlord), warlordId: a.warlordId == null ? null : str(a.warlordId),
      formation: str(a.formation).trim(),
      notes: str(a.notes), color: validColor(a.color), archived: a.archived === true,
      units: records(a.units, normalizeUnit),
      lores: records(a.lores, normalizeLore),
      battleTraits: records(a.battleTraits, t => ({ name: str(t.name) || 'Unnamed trait', timing: str(t.timing), declare: str(t.declare), effect: str(t.effect) })),
      battleView: records(a.battleView, unitBattleStats),
      quests: records(a.quests, q => ({
        title: str(q.title) || 'Unnamed quest', goal: str(q.goal), status: choice(q.status === 'Abandoned' ? 'Forfeited' : q.status, questStatuses, 'Active'),
        reward: str(q.reward), notes: str(q.notes), target: Math.max(0, integer(q.target)), progress: Math.max(0, integer(q.progress)),
      })),
      ledger: records(a.ledger, l => ({ date: cleanDate(l.date), reason: str(l.reason), delta: integer(l.delta), kind: legacyResource || l.kind === 'resource' ? 'resource' : 'glory' })),
    }));
    for (const army of armies) {
      const currentQuest = activeQuest(army);
      for (const quest of army.quests) {
        if (quest.status === 'Active' && quest !== currentQuest) quest.status = 'Forfeited';
      }
      if (army.warlordId === null && army.warlord.trim()) {
        const matches = army.units.filter(unit => unit.type === 'Hero' && unitName(unit) === army.warlord.trim());
        if (matches.length === 1) army.warlordId = matches[0].id;
      }
      army.warlordId = warlord(army)?.id ?? '';
    }
    return {
      version: 3,
      campaign: {
        name: str(c.name) || 'My Path to Glory', pack, location: str(c.location),
        resource,
        pointsLimit: Math.max(1, integer(c.pointsLimit) || 1000), notes: str(c.notes),
      },
      activeWarbandId: armies.find(a => a.id === value.activeWarbandId && !a.archived)?.id ?? latestWarband(armies)?.id ?? '',
      armies,
      battles: records(value.battles, b => ({
        title: str(b.title) || 'Unnamed battle', date: cleanDate(b.date), battleplan: str(b.battleplan),
        armyId: str(b.armyId), opponentArmyId: str(b.opponentArmyId), opponent: str(b.opponent),
        result: choice(b.result, resultOptions, 'Other'), notes: str(b.notes),
        delta: legacyResource ? 0 : integer(b.delta), oppDelta: legacyResource ? 0 : integer(b.oppDelta),
        resourceDelta: integer(legacyResource ? b.delta : b.resourceDelta), oppResourceDelta: integer(legacyResource ? b.oppDelta : b.oppResourceDelta),
        questId: str(b.questId), questPoints: Math.max(0, integer(b.questPoints)),
        awards: records(b.awards, a => ({ armyId: str(a.armyId), unitId: str(a.unitId), unitName: str(a.unitName), delta: integer(a.delta), scars: Math.max(0, integer(a.scars)), ...unitBattleStats(a) })),
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

  const unitMultiplier = unit => unit.reinforced === true ? 2 : 1;
  const unitUpgradePoints = unit => (unit.upgrades ?? []).reduce((sum, upgrade) => sum + upgrade.cost, 0);
  const unitPoints = unit => unit.points * unitMultiplier(unit) + unitUpgradePoints(unit);
  const unitSize = (unit, catalogueSize = null) => {
    const baseSize = unit.size ?? catalogueSize;
    return baseSize === null ? null : baseSize * unitMultiplier(unit);
  };
  const lorePoints = army => (army.lores ?? []).reduce((sum, lore) => sum + lore.points, 0);
  const points = (army, battles) => army.units.reduce((sum, unit) => sum + (rosterStatus(unit, army.id, battles) === 'Retired' ? 0 : unitPoints(unit)), lorePoints(army));
  const participants = battle => [battle.armyId, battle.opponentArmyId].filter(Boolean);
  const signed = value => value > 0 ? `+${value.toLocaleString()}` : value.toLocaleString();

  function balance(state, army, kind) {
    return transactions(state, army, kind).reduce((sum, entry) => sum + entry.delta, 0);
  }

  function transactions(state, army, kind = 'glory') {
    const entries = army.ledger.filter(entry => entry.kind === kind).map(entry => ({ ...entry, manual: true }));
    const [first, opponent] = kind === 'resource' ? ['resourceDelta', 'oppResourceDelta'] : ['delta', 'oppDelta'];
    for (const b of state.battles) {
      const delta = b.armyId === army.id ? b[first] : b.opponentArmyId === army.id ? b[opponent] : 0;
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

  function battleScarAwards(battles = [], armyId, unitId) {
    return battles.reduce((total, battle) => total + battle.awards.reduce((sum, award) =>
      sum + (award.armyId === armyId && award.unitId === unitId ? award.scars ?? 0 : 0), 0), 0);
  }

  const unitBattleScars = (unit, armyId, battles) => (unit.battleScars ?? 0) + battleScarAwards(battles, armyId, unit.id);
  const rosterStatus = (unit, armyId, battles) => unitStatus(unit.status, unitBattleScars(unit, armyId, battles));

  function questBattlePoints(battles, armyId, questId) {
    return battles.reduce((sum, battle) => sum + (battle.armyId === armyId && battle.questId === questId ? battle.questPoints ?? 0 : 0), 0);
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

  return { packs, gloryPoints, resourceName, latestWarband, resultOptions, unitStatuses, unitStatus, battleReady, battleScarSeverity, isScarred, questStatuses, activeQuest, questBattlePoints, unitBattleStats, unitTypes, unitType, unitName, warlord, sortedUnits, profileStats, weaponFields, normalizeProfileEdits, profileDefaults, profileAbilityEdits, profileChanges, validColor, integer, id, date, dateOrder,
    blank, normalize, normalizeAnvil, destinySpent, unitPoints, unitUpgradePoints, unitSize, loreKinds, lorePoints, points, participants, signed, balance, transactions, unitHistory, battleRenown, battleScarAwards, unitBattleScars, rosterStatus, record, resultFor };
})();
