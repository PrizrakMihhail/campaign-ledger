# Path to Glory Campaign Ledger

The app is a static site. Open `dist/index.html` in a browser to run a local copy. The same directory is the deployable site. No install or build step is needed.

## Source map

Follow the file link, then search for the symbol or CSS selector in the last column.

| To change | Open | Search for |
| --- | --- | --- |
| Routes, navigation, or event wiring | [App](dist/app.js), [script order](dist/index.html) | `const pages`, `const actions` |
| Unit cards, editor, or resource adjustments | [Warbands](dist/features/warbands.js) | `unitCard`, `unitForm`, `resourceForm` |
| Anvil choices, upgrades, or custom profiles | [Anvil editor](dist/features/anvil-hero.js), [upgrades](dist/features/unit-upgrades.js), [profile editor](dist/features/unit-profile-editor.js) | `mountAnvilEditor`, `mountUnitUpgrades`, `attachProfileEditor` |
| Spells, prayers, and manifestations | [Arcane Tome](dist/features/arcane-tome.js) | `loreCard`, `loreEntryForm`, `arcaneTomeActions` |
| Battle results, filters, or Renown awards | [Battles](dist/features/battles.js) | `battleForm`, `battleResults` |
| Overview, quests, chronicle, or settings | [Campaign](dist/features/campaign.js) | `overview`, `quests`, `chronicle`, `settings` |
| Card fields, export content, or print selection | [Datacards](dist/features/datacards.js) | `datacard`, `loreDatacard`, `warbandDatacards`, `printChoice` |
| Export colors, columns, or print layout | [Datacard styles](dist/ui/datacard-styles.js) | `datacardStyles`, `datacardExportStyles` |
| In-app colors, unit card design, or lore card design | [App styles](dist/assets/styles.css), [campaign card styles](dist/assets/campaign-cards.css) | `:root`, `.unit-card`, `.lore-entry-card` |
| Unit and warband points or backup conversion | [Ledger model](dist/domain/ledger.js), [browser store](dist/storage/campaign-store.js) | `unitPoints`, `lorePoints`, `normalize`, `migrateLegacy` |
| Profile matching or catalogue search | [Profile matching](dist/domain/unit-profiles.js), [profile library](dist/features/profile-library.js), [search picker](dist/ui/text-picker.js) | `unitCatalogueEntry`, `libraryResults`, `mountTextPicker` |
| Shared controls, dialogs, or file downloads | [UI components](dist/ui/components.js), [dialogs](dist/ui/dialogs.js), [downloads](dist/storage/downloads.js) | `field`, `formDialog`, `downloadFile` |

The app loads classic scripts in dependency order, with `app.js` last. The downloaded HTML embeds both datacard style blocks and opens offline. When changing a record shape, update `Ledger.normalize` and check that older JSON backups still load.

## Update catalogue data

Use local copies of the source PDF and Wahapedia CSV export. Rebuild the points and model counts first, then apply the Khazalite Holds warscrolls from the saved HTML page. The second command restores the supplementary characteristics and rules after a rebuild. To refresh abilities alone on an existing catalogue, use `--abilities-only` in place of `--retrieved` and its date.

```text
python tools/build_catalogue.py <battle-profiles.pdf> <csv-folder> dist/data/battle-catalogue-data.js
python tools/update_khazalite_warscrolls.py dist/data/battle-catalogue-data.js <warscrolls.html> --retrieved <YYYY-MM-DD>
```

The data tools use `pdfplumber` and `lxml`. Keep source downloads outside `dist/`. The generated catalogue follows the PDF for points and model counts. The HTML updater adds matching warscroll details.

## Verify and publish

Run `node tools/check.mjs` from the project root. It checks script and asset paths, all seven routes, datacard exports, legacy backups, and storage conflicts. Review the diff before deploying, especially when changing catalogue sources or browser storage.

Use the existing Sites project in `.openai/hosting.json` to publish `dist/`. Browser storage is scoped to the site address. Use a JSON backup to move records between a local copy and the hosted site.
