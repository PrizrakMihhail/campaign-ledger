# Path to Glory Campaign Ledger

The app is a static site. Open `dist/index.html` in a browser to run a local copy. The same directory is the deployable site. No install or build step is needed.

## Where to make a change

| Change | Files |
| --- | --- |
| Warbands, units, resource adjustments | `dist/features/warbands.js` |
| Searchable warscrolls and factions | `dist/ui/text-picker.js` |
| Anvil hero choices and Destiny Points | `dist/features/anvil-hero.js` |
| Unit characteristics, weapons, and ability editor | `dist/features/unit-profile-editor.js` |
| Battles, filters, and Renown awards | `dist/features/battles.js` |
| Arcane Tome lores and their entries | `dist/features/arcane-tome.js` |
| Overview, quests, chronicle, and settings | `dist/features/campaign.js` |
| Datacard preview, standalone HTML, or print layout | `dist/features/datacards.js` |
| Profile library and search | `dist/features/profile-library.js` |
| Catalogue entries and source data | `dist/data/` and `tools/` |
| Record shapes, calculations, and profile overrides | `dist/domain/` |
| Browser storage and downloads | `dist/storage/` |
| Shared form controls, dialogs, styling, and artwork | `dist/ui/` and `dist/assets/` |

`dist/app.js` connects routes, actions, and persistence. `dist/index.html` loads classic scripts in dependency order, with the app last. This keeps direct file opening available and gives the hosted app the same entry point. Keep shared datacard styles with the card renderer so the downloaded HTML can include them without network access.

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
