# Path to Glory Campaign Ledger

A browser-based campaign companion for Warhammer Age of Sigmar: Path to Glory. Keep the campaign, warbands, battles, quests, and unit progression together in one place.

## Open the app

**[Launch the Path to Glory Campaign Ledger](https://prizrakmihhail.github.io/campaign-ledger/)**

No account or installation is required. Your campaign is saved in the browser you use to open the app.

## What you can do

### Manage a campaign

- Set the campaign name, battlepack, region, points limit, and campaign resource.
- See an overview of the active warband, recent battles, Glory Points, and active quests.
- Keep a dated campaign chronicle with campaign-wide or warband-specific notes.
- Manage several warbands in the same campaign, archive those no longer in play, or permanently remove a warband when it is no longer needed.

### Build and develop warbands

- Choose a faction and import its available Battle Formation when creating a warband.
- Add units from the built-in Age of Sigmar profile catalogue or enter a custom profile.
- Track points, model count, Reinforced status, Renown, rank, progression path, enhancements, Battle Scars, and injuries.
- Create custom Anvil of Apotheosis heroes, including their archetype, origin, flaw, mount, and upgrades.
- Maintain a ledger of Glory Points and other campaign resources, including manual adjustments and rewards from battles.
- Browse the profile library for available factions and units.
- Import faction rules into an existing warband if it was created before the catalogue was available or its rules were not selected during creation.

### Record battles and progression

- Log the battleplan, opponent, result, date, and aftermath notes.
- Apply Glory Point and campaign-resource changes to both participating warbands.
- Award Renown and Battle Scars to individual units.
- Add Quest Points earned during the battle.
- Review a unit's complete battle and progression history.
- Use **Battle View** during a game to track wounds, ward saves, kills, Quest Points, and temporary notes for each unit.

### Track quests and campaign rules

- Create quests with objectives and optional Quest Point targets.
- Combine manually entered progress with Quest Points from recorded battles.
- Complete or forfeit quests while retaining their history.
- Import individual Battle Traits or the complete standard trait list for a faction.
- Keep standard faction Battle Traits separate from Army of Renown traits, and select the relevant Army of Renown from the import list.
- Import complete spell, prayer, and manifestation lores—or select individual entries—for each warband's Arcane Tome.
- Use both shared and faction-specific manifestation lores, and add a linked manifestation unit to the warband roster when a profile is available.
- Add custom Battle Traits, spells, prayers, manifestations, and lores alongside imported content.
- Edit imported entries after adding them, so campaign-specific changes and house rules are preserved.

### Use and print datacards

- View unit profiles, weapons, abilities, upgrades, lore, and Battle Traits as game-ready cards.
- Export a warband as a standalone HTML file that works offline.
- Choose which cards and abilities to include before printing.

## Saving and moving your campaign

Campaign data is stored locally in your browser. It is not uploaded to an account or synchronized between devices.

Use **Export backup** to download a JSON copy of the open campaign. Use **Import backup** to restore that copy as a separate campaign or move it to another browser or device.

You can also print the campaign overview from **Settings**.

## Getting started

1. Open the [Campaign Ledger](https://prizrakmihhail.github.io/campaign-ledger/).
2. Open a saved campaign, create a campaign, or import an existing JSON backup. Use **Campaign selection** on the Overview to switch campaigns.
3. Create a warband, choose its faction, and select the faction rules you want to import.
4. Add units from the profile catalogue or create custom units.
5. Use **Import faction rules** later if you want to add catalogue data to an existing warband.
6. Record battles, unit progression, resources, and quest progress as the campaign develops.

## Imported rules and profiles

The faction catalogue includes Age of Sigmar factions, unit profiles, Battle Formations, Battle Traits, Armies of Renown, spell and prayer lores, and shared or faction-specific manifestation lores and profiles. GitHub Pages publishes the checked-in catalogue by default. To deploy with fresh data from [Wahapedia](https://wahapedia.ru/), enable the catalogue refresh when manually running the **Deploy to GitHub Pages** workflow. To carry the refresh forward into future deployments, run the sync locally and commit the generated files.

Imported content is copied into your warband. You can edit or remove it without changing the catalogue, and a later catalogue refresh will not overwrite your saved customizations. Existing warbands are not changed automatically; use **Import faction rules** to choose which new catalogue entries to add.

Wahapedia is an unofficial rules reference. For tournament play or rules disputes, check the current official publications and errata.

The app is designed for modern desktop and mobile browsers.
