'use strict';

function unitUpgradeFields() {
  return `<details class="full unit-editor-section"><summary>Upgrades</summary>
    <div id="unit-upgrades"></div>
    <button type="button" class="button secondary" id="add-unit-upgrade">Add upgrade</button>
  </details>`;
}

function mountUnitUpgrades(form, saved = [], onChange) {
  const list = form.querySelector('#unit-upgrades');
  const addUpgrade = form.querySelector('#add-unit-upgrade');
  let nextUpgrade = 0;

  function addRow(upgrade = {}) {
    const key = `unit-upgrade-${++nextUpgrade}`;
    list.insertAdjacentHTML('beforeend', `<fieldset class="profile-row"><legend>Upgrade</legend>
      <div class="profile-fields">
        ${field('Type', `${key}-type`, upgrade.type, { placeholder: 'Hero Trait, Enhancement…' })}
        ${field('Name', `${key}-name`, upgrade.name, { required: true })}
        ${field('Cost', `${key}-cost`, upgrade.cost ?? 0, { placeholder: 'Battle points' })}
        ${area('Description', `${key}-description`, upgrade.description)}
      </div><button type="button" class="button link" data-remove-upgrade>Remove upgrade</button>
    </fieldset>`);
    return list.lastElementChild;
  }

  for (const upgrade of saved) addRow(upgrade);
  list.addEventListener('input', event => { if (event.target.name.endsWith('-cost')) onChange(); });
  list.addEventListener('click', event => {
    const remove = event.target.closest('[data-remove-upgrade]');
    if (!remove) return;
    remove.closest('fieldset').remove();
    onChange();
    addUpgrade.focus();
  });
  addUpgrade.addEventListener('click', () => addRow().querySelector('input').focus());
  return {
    read(validate = false) {
      return Array.from(list.children, row => {
        const [type, name, cost, description] = Array.from(row.querySelectorAll('input, textarea'), input => input.value.trim());
        return {
          type, name: validate ? required(name, 'Upgrade name') : name,
          cost: validate ? whole(cost, 'Upgrade cost', 0) : Math.max(0, Ledger.integer(cost)),
          description,
        };
      });
    },
  };
}
