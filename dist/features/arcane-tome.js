'use strict';

const loreLabels = {
  spell: { title: 'Spell Lore', entry: 'spell', value: 'Casting value' },
  prayer: { title: 'Prayer Lore', entry: 'prayer', value: 'Chanting value' },
  manifestation: { title: 'Manifestation Lore', entry: 'manifestation', value: 'Summoning value' },
};

function arcaneTome() {
  const title = heading('Arcane Tome', 'Spells, prayers, and manifestations for each warband.');
  const a = viewedArmy();
  if (!a) return title + empty('No warband selected', 'Select or create a warband to track its lores.', pageLink('View warbands', 'warbands'));

  const summary = section(a.name, `<div class="arcane-summary">
    <p class="meta"><strong class="gold">${fmt(Ledger.lorePoints(a))}</strong> battle pts from lores</p>
    <p class="meta"><strong>${fmt(Ledger.points(a, CampaignStore.data.battles))} / ${fmt(CampaignStore.data.campaign.pointsLimit)}</strong> roster pts</p>
  </div>`);
  const groups = Ledger.loreKinds.map(kind => {
    const { title, entry } = loreLabels[kind];
    const lores = a.lores.filter(lore => lore.kind === kind);
    const body = lores.length ? `<div class="stack">${lores.map(loreCard).join('')}</div>`
      : empty('No lores added', `Add a lore to record a ${entry} for this warband.`);
    return section(title, body, button('Add lore', 'new-lore', { type: 'primary', glyph: 'plus', id: kind, title: `Add ${title}` }), kind);
  }).join('');
  return title + `<div class="layout roster-layout">${summary}<div class="stack">${groups}</div></div>`;
}

function loreCard(lore) {
  const labels = loreLabels[lore.kind];
  const entries = lore.entries.map(entry => {
    const ref = JSON.stringify([lore.id, entry.id]);
    return `<article class="lore-entry-card"><div class="lore-entry-heading"><h4 class="row-title">${escape(entry.name)}</h4>
      ${entry.value ? `<span class="meta lore-entry-value">${escape(labels.value)} <strong>${escape(entry.value)}</strong></span>` : ''}</div>
      ${entry.declare ? `<p class="copy"><strong>Declare</strong> ${escape(entry.declare)}</p>` : ''}
      ${entry.effect ? `<p class="copy"><strong>Effect</strong> ${escape(entry.effect)}</p>` : ''}
      <div class="lore-entry-actions">${button('Edit', 'edit-lore-entry', { id: ref, title: `Edit ${entry.name}` })}</div></article>`;
  }).join('');
  return `<article class="card arcane-lore" data-lore="${escape(lore.kind)}"><div class="split"><h3 class="row-title">${icon(lore.kind)}${escape(lore.name)}</h3>
    ${badge(`${fmt(lore.points)} battle pts`, 'lore-cost')}</div>
    <div class="actions">${button(`Add ${labels.entry}`, 'new-lore-entry', { id: lore.id, glyph: 'plus' })}
    ${button('Edit lore', 'edit-lore', { id: lore.id, title: `Edit ${lore.name}` })}</div>
    ${entries ? `<div class="lore-entry-list">${entries}</div>` : `<p class="meta">Add the first ${labels.entry} to this lore.</p>`}</article>`;
}

function loreForm(a, kind, lore) {
  const { title } = loreLabels[kind];
  const fields = field('Lore name', 'name', lore?.name, { full: true, required: true }) +
    field('Battle point cost', 'points', lore?.points ?? 0, { type: 'number', min: 0 });
  formDialog(`${lore ? 'Edit' : 'Add'} ${title}`, fields, values => {
    const name = required(values.name, 'Lore name');
    const points = whole(values.points, 'Battle point cost', 0);
    if (lore) Object.assign(lore, { name, points });
    else a.lores.push({ id: Ledger.id(), kind, name, points, entries: [] });
    return [lore ? 'Lore updated.' : 'Lore added.'];
  }, {
    label: lore ? 'Save changes' : 'Add lore',
    description: 'Enter 0 for a free lore. This cost counts toward the warband’s roster points.',
    remove: lore && button('Delete lore', 'remove-lore', { id: lore.id, type: 'danger' }),
  });
}

function loreEntryForm(lore, entry) {
  const labels = loreLabels[lore.kind];
  const fields = `<div class="lore-entry-fields full">${field('Name', 'name', entry?.name, { required: true })}
    ${field(labels.value, 'value', entry?.value)}</div>` +
    area('Declare', 'declare', entry?.declare) + area('Effect', 'effect', entry?.effect, 5);
  formDialog(`${entry ? 'Edit' : 'Add'} ${labels.entry}`, fields, values => {
    const details = {
      name: required(values.name, 'Name'), value: values.value.trim(),
      declare: values.declare.trim(), effect: values.effect.trim(),
    };
    if (entry) Object.assign(entry, details);
    else lore.entries.push({ id: Ledger.id(), ...details });
    return [entry ? 'Entry updated.' : 'Entry added.'];
  }, {
    label: entry ? 'Save changes' : `Add ${labels.entry}`,
    remove: entry && button(`Delete ${labels.entry}`, 'remove-lore-entry', { id: JSON.stringify([lore.id, entry.id]), type: 'danger' }),
  });
}

const activeLore = id => viewedArmy()?.lores.find(lore => lore.id === id);

function loreEntryTarget(ref) {
  const [loreId, entryId] = JSON.parse(ref);
  const lore = activeLore(loreId);
  return [lore, lore?.entries.find(entry => entry.id === entryId)];
}

const arcaneTomeActions = {
  'new-lore': kind => loreForm(viewedArmy(), kind),
  'edit-lore': id => {
    const lore = activeLore(id);
    if (lore) loreForm(viewedArmy(), lore.kind, lore);
  },
  'remove-lore': id => {
    const lore = activeLore(id);
    if (lore) removeRecord(viewedArmy().lores, lore, 'Delete lore?', 'This removes the lore, all entries in it, and its battle point cost.');
  },
  'new-lore-entry': id => {
    const lore = activeLore(id);
    if (lore) loreEntryForm(lore);
  },
  'edit-lore-entry': ref => {
    const [lore, entry] = loreEntryTarget(ref);
    if (entry) loreEntryForm(lore, entry);
  },
  'remove-lore-entry': ref => {
    const [lore, entry] = loreEntryTarget(ref);
    if (entry) {
      const { entry: label } = loreLabels[lore.kind];
      removeRecord(lore.entries, entry, `Delete ${label}?`, `This removes the ${label} from its lore.`);
    }
  },
};
