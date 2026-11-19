'use strict';

const WarbandProfiles = (() => {
  const source = 'Khazalite Holds battletome supplement';
  const hero = ['Hero', 'Infantry'];
  const infantry = ['Infantry', 'Champion', 'Musician (1/10)'];
  const invocation = ['Manifestation', 'Invocation'];
  const faction = ['Order', 'Khazalite Holds'];
  const grimmdron = [...faction, 'Duardin', 'Grimmdron'];

  const entries = [
    {
      name: 'Auric Runemaster', category: 'Hero', page: 2,
      move: '4″', health: '5', save: '5+', control: '2', keywords: [...hero, 'Priest (1)', ...grimmdron],
      melee: [['Brazier Staff', '3', '3+', '3+', '1', '2']],
      abilities: ['Master of the Runes', 'High Priest of the Zharrgrim'],
    },
    {
      name: 'Battlesmith', category: 'Hero', page: 3,
      move: '4″', health: '5', save: '5+', control: '5', keywords: [...hero, ...grimmdron],
      melee: [['Ancestral Battle-axe', '5', '3+', '3+', '1', '2']],
      abilities: ['Icon of Grimnir', 'Bard of the Lodge'],
    },
    {
      name: 'Grimwrath Berzerker', category: 'Hero', page: 3,
      move: '4″', health: '5', save: '5+', control: '2', keywords: [...hero, ...grimmdron],
      melee: [['Fyrestorm Greataxe', '5', '3+', '3+', '2', '2']],
      abilities: ['Battle-Fury', 'Grimwrath Oaths'],
    },
    {
      name: 'Doomseeker', category: 'Hero', page: 4,
      move: '4″', health: '5', save: '5+', control: '2', keywords: [...hero, ...grimmdron],
      melee: [['Doomseeker Weapons', '5', '3+', '3+', '1', '2']],
      abilities: ['Runic Power', 'Oathbound'],
    },
    {
      name: 'Vulkite Berzerkers with Bladed Slingshields', category: 'Infantry', page: 4,
      move: '4″', health: '2', save: '5+', control: '1', keywords: [...infantry, ...grimmdron],
      melee: [['Fyresteel Weapons', '2', '4+', '3+', '1', '1']],
      abilities: ['Berserk Fury'],
    },
    {
      name: 'Vulkite Berzerkers with Fyresteel Weapons', category: 'Infantry', page: 5,
      move: '4″', health: '2', save: '6+', control: '1', keywords: [...infantry, ...grimmdron],
      melee: [['Fyresteel Weapons', '2', '4+', '3+', '1', '1']],
      abilities: ['Whirlwind of Destruction'],
    },
    {
      name: 'Molten Infernoth', category: 'Manifestation', page: 5,
      move: '8″', health: '10', save: '5+', banishment: '7+', summon: '6', keywords: [...invocation, 'Fly', ...faction],
      ranged: [['Raging Torrents of Lava', '8″', '2', '4+', '3+', '2', 'D3', 'Shoot in Combat']],
      melee: [['Molten Claws', '6', '4+', '2+', '1', 'D3', 'Crit (Mortal)']],
      abilities: ['Flamescarred'],
    },
    {
      name: 'Runic Fyrewall', category: 'Manifestation', page: 6,
      move: '—', health: '8', save: '3+', banishment: '7+', summon: '4', keywords: [...invocation, ...faction],
      abilities: ['Roaring Rune-Fire'],
    },
    {
      name: 'Zharrgron Flame-spitter', category: 'Manifestation', page: 6,
      move: '—', health: '5', save: '6+', banishment: '7+', summon: '4', keywords: [...invocation, ...faction],
      ranged: [['Magma Blast', '12″', '4', '4+', '3+', '1', '2', 'Crit (2 Hits)']],
      abilities: ['Magma Blast'],
    },
    {
      name: 'Magmic Battleforge', category: 'Terrain', page: 7,
      move: '—', health: '8', save: '3+', control: '—', keywords: ['Faction Terrain', ...faction],
      abilities: ['Cover', 'Impassable', 'Obscuring', 'Molten Blessing', 'Spending the Forge'],
    },
  ].map(entry => ({ ...entry, ward: '6+' }));

  const roster = entries.filter(profile => ['Hero', 'Infantry'].includes(profile.category));
  const references = entries.filter(profile => !roster.includes(profile));
  const key = value => value?.toLowerCase().replace(/\bwith\b/g, '').replace(/[^a-z0-9]/g, '');
  const names = new Map(roster.map(profile => [key(profile.name), profile]));

  return { source, roster, references, find: name => names.get(key(name)) };
})();
