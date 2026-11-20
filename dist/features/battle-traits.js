'use strict';

function traitRulesets(warband) {
  const rules = BattleCatalogue.rules(warband.faction);
  return [{ id: 'faction', name: `${warband.faction} — Standard Faction`, traits: rules?.battleTraits || [] },
    ...(rules?.armiesOfRenown || []).map(army => ({ id: army.id, name: army.name, traits: army.battleTraits })),
    { id: 'formation', name: 'Battle Formation Abilities', traits: (rules?.battleFormations || []).flatMap(formation => formation.abilities.map(ability => ({ ...ability, name: `${formation.name} — ${ability.name}` }))) },
    { id: 'custom', name: 'Custom Traits', traits: [] }];
}

function traitRuleset(warband, trait) {
  if (trait.ruleset) return trait.ruleset;
  const normalized = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const matches = traitRulesets(warband).filter(group => group.traits.some(item => normalized(item.name) === normalized(trait.name)));
  return matches.length === 1 ? matches[0].id : 'custom';
}

function importTraitList(warband, ruleset) {
  const group = traitRulesets(warband).find(item => item.id === ruleset);
  if (!group) throw new Error('Choose a trait ruleset.');
  warband.battleTraits ??= [];
  let added = 0;
  const normalized = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const trait of group.traits) {
    if (warband.battleTraits.some(saved => traitRuleset(warband, saved) === ruleset && normalized(saved.name) === normalized(trait.name))) continue;
    warband.battleTraits.push({ id: Ledger.id(), name: optionTitle(trait.name), timing: trait.timing || '', declare: trait.declare || '', effect: trait.effect || '', ruleset });
    added++;
  }
  return added;
}

function traitListImportForm(warband) {
  const choices = traitRulesets(warband).filter(group => !['custom', 'formation'].includes(group.id));
  const preview = choices.map(group => `<p class="meta">${escape(optionTitle(group.name))} · ${group.traits.length} traits</p>`).join('');
  formDialog('Import battle traits', select('Faction or Army of Renown', 'traitRuleset', choices.map(group => [group.id, group.name]), 'faction') + `<div class="full">${preview}</div>`, values => {
    const count = importTraitList(warband, values.traitRuleset);
    return [`${count} battle traits added. Existing customizations kept.`, 'warbands'];
  }, { label: 'Import full trait list', description: 'Choose the standard faction or one of its Armies of Renown. Each has its own ruleset; Army of Renown traits replace the standard rules in play. Importing keeps your existing records and edits.' });
}

function battleTraitsSection(warband) {
  const groups = traitRulesets(warband);
  const cards = traits => traits.map(trait => `<article class="card battle-trait-card">
    <h3>${icon('shield')}${escape(trait.name)}</h3>${span('Timing', trait.timing)}${span('Declare', trait.declare)}${span('Effect', trait.effect)}
    <div class="actions">${button('Edit trait', 'edit-battle-trait', { id: trait.id })}</div></article>`).join('');
  const present = new Set((warband.battleTraits || []).map(trait => traitRuleset(warband, trait)));
  for (const id of present) if (!groups.some(group => group.id === id)) groups.push({ id, name: id });
  const traits = groups.filter(group => present.has(group.id)).map(group => `<div class="stack"><h3>${escape(optionTitle(group.name))}</h3><div class="cards">${cards(warband.battleTraits.filter(trait => traitRuleset(warband, trait) === group.id))}</div></div>`).join('');
  return section('Battle Traits', traits ? `<div class="stack">${traits}</div>`
    : empty('No battle traits', 'Add a trait for this warband’s faction.'), button('Import full trait list', 'import-trait-list') + add('Add battle trait', 'new-battle-trait'), 'shield');
}

function battleTraitForm(warband, existing) {
  const trait = existing || {};
  const groups = traitRulesets(warband);
  const initialGroup = existing ? traitRuleset(warband, trait) : 'faction';
  const choices = [...(groups.find(group => group.id === initialGroup)?.traits || [])];
  const fields = select('Trait ruleset', 'ruleset', groups.map(group => [group.id, group.name]), initialGroup) + importedChoiceFields(choices.length ? choices : [{ name: 'No imported traits' }], 'Trait reference') + field('Trait name', 'name', trait.name, { required: true }) + field('Timing', 'timing', trait.timing) +
    area('Declare', 'declare', trait.declare) + area('Effect', 'effect', trait.effect, 5);
  formDialog(existing ? 'Edit battle trait' : 'Add battle trait', fields, values => {
    const details = { name: required(values.name, 'Trait name'), timing: values.timing.trim(), declare: values.declare.trim(), effect: values.effect.trim(), ruleset: values.ruleset || initialGroup };
    if (existing) Object.assign(existing, details);
    else warband.battleTraits.push({ id: Ledger.id(), ...details });
    return ['Battle trait saved.'];
  }, {
    label: 'Save battle trait',
    remove: existing && button('Delete battle trait', 'remove-battle-trait', { id: trait.id, type: 'danger' }),
  });
  const form = dialog.querySelector('#editor-form');
  mountImportedChoice(form, choices, item => {
    const fields = dialog.querySelector('#editor-form').elements;
    for (const key of ['name', 'timing', 'declare', 'effect']) fields[key].value = key === 'name' ? optionTitle(item.name) : item[key] || '';
  });
  form.elements?.ruleset?.addEventListener('change', () => {
    choices.splice(0, choices.length, ...(groups.find(group => group.id === form.elements.ruleset.value)?.traits || []));
    form.elements.importedChoice.innerHTML = `<option value="">Choose An Imported Item</option>` + choices.map((item, index) => `<option value="${index}">${escape(optionTitle(item.name))}</option>`).join('');
    form.elements.importedChoice.value = '';
    form.querySelector('#apply-imported-choice').disabled = true;
  });
}
