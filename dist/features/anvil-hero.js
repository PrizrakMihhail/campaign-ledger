'use strict';

function anvilFields(anvil) {
  return `<section class="full anvil-editor" aria-labelledby="anvil-heading">
    <h3 id="anvil-heading">Anvil of Apotheosis</h3>
    <div class="profile-fields">
      ${field('Destiny Point limit', 'anvil-limit', anvil?.limit ?? '', { type: 'number', min: 0, placeholder: 'Optional' })}
      ${field('Rules reference', 'anvil-rules', anvil?.rules, { placeholder: 'Battletome or campaign variant' })}
    </div>
    <p class="meta anvil-totals" aria-live="polite" id="anvil-totals"></p>
    <div id="anvil-choices"></div>
    <div class="actions"><button type="button" class="button secondary" id="add-anvil-choice">Add choice</button><span class="meta">Use a negative cost for a refund.</span></div>
  </section>`;
}

function anvilSummary(anvil) {
  const spent = Ledger.destinySpent(anvil);
  if (anvil.limit === null) return `${fmt(spent)} Destiny Points spent`;
  const remaining = anvil.limit - spent;
  const balance = remaining >= 0 ? `${fmt(remaining)} remaining` : `${fmt(-remaining)} over limit`;
  return `${fmt(spent)} / ${fmt(anvil.limit)} Destiny Points spent · ${balance}`;
}

function mountAnvilEditor(form, saved) {
  const list = form.querySelector('#anvil-choices');
  const total = form.querySelector('#anvil-totals');
  const addChoice = form.querySelector('#add-anvil-choice');
  const limit = form.elements['anvil-limit'];
  let nextChoice = 0;

  function row(choice = {}) {
    const id = `anvil-choice-${++nextChoice}`;
    list.insertAdjacentHTML('beforeend', `<fieldset class="profile-row"><legend>Anvil choice</legend><div class="profile-fields">
      ${field('Stage', `${id}-stage`, choice.stage, { placeholder: 'Origin, flaw, mount, upgrade…' })}
      ${field('Choice name', `${id}-name`, choice.name, { required: true })}
      ${field('Destiny Point cost', `${id}-cost`, choice.cost ?? '', { type: 'number' })}
      ${area('Notes', `${id}-notes`, choice.notes, 2)}
      </div><button type="button" class="button link" data-remove-anvil-choice>Remove choice</button></fieldset>`);
    return list.lastElementChild;
  }

  function read() {
    const choices = Array.from(list.children, entry => {
      const [stage, name, cost, notes] = Array.from(entry.querySelectorAll('input, textarea'), field => field.value);
      return { stage, name, cost: Ledger.integer(cost), notes };
    });
    return {
      limit: limit.value === '' ? null : Ledger.integer(limit.value, null),
      rules: form.elements['anvil-rules'].value,
      choices,
    };
  }

  function refresh() {
    const anvil = read();
    total.textContent = anvilSummary(anvil);
    total.classList.toggle('negative', anvil.limit !== null && Ledger.destinySpent(anvil) > anvil.limit);
  }

  for (const choice of saved?.choices ?? []) row(choice);
  limit.addEventListener('input', refresh);
  list.addEventListener('input', event => { if (event.target.name.endsWith('-cost')) refresh(); });
  list.addEventListener('click', event => {
    const remove = event.target.closest('[data-remove-anvil-choice]');
    if (!remove) return;
    remove.closest('fieldset').remove();
    refresh();
    addChoice.focus();
  });
  addChoice.addEventListener('click', () => row().querySelector('input').focus());
  refresh();
  return () => Ledger.normalizeAnvil(read());
}

function anvilCard(anvil) {
  if (!anvil) return '';
  const choices = anvil.choices.map(item => `<li>
    <strong>${escape(item.name)}</strong><span>${escape([item.stage, `${fmt(item.cost)} DP`].filter(Boolean).join(' · '))}</span>
    ${item.notes ? `<p>${escape(item.notes)}</p>` : ''}</li>`).join('');
  return `<section class="dc-detail dc-anvil"><h3>Anvil of Apotheosis</h3><p>${escape(anvilSummary(anvil))}</p>
    ${anvil.rules ? `<p>${escape(anvil.rules)}</p>` : ''}${choices ? `<ul>${choices}</ul>` : ''}</section>`;
}
