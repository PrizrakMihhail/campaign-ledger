'use strict';

function battleTraitsSection(warband) {
  const traits = (warband.battleTraits ?? []).map(trait => `<article class="card">
    <h3>${escape(trait.name)}</h3>${span('Timing', trait.timing)}${span('Declare', trait.declare)}${span('Effect', trait.effect)}
    <div class="actions">${button('Edit trait', 'edit-battle-trait', { id: trait.id })}</div></article>`).join('');
  return section('Battle Traits', traits ? `<div class="cards">${traits}</div>`
    : empty('No battle traits', 'Add a trait for this warband’s faction.'), add('Add battle trait', 'new-battle-trait'));
}

function battleTraitForm(warband, existing) {
  const trait = existing || {};
  const fields = field('Trait name', 'name', trait.name, { required: true }) + field('Timing', 'timing', trait.timing) +
    area('Declare', 'declare', trait.declare) + area('Effect', 'effect', trait.effect, 5);
  formDialog(existing ? 'Edit battle trait' : 'Add battle trait', fields, values => {
    const details = { name: required(values.name, 'Trait name'), timing: values.timing.trim(), declare: values.declare.trim(), effect: values.effect.trim() };
    if (existing) Object.assign(existing, details);
    else warband.battleTraits.push({ id: Ledger.id(), ...details });
    return ['Battle trait saved.'];
  }, {
    label: 'Save battle trait',
    remove: existing && button('Delete battle trait', 'remove-battle-trait', { id: trait.id, type: 'danger' }),
  });
}
