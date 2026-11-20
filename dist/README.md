# Path to Glory Campaign Ledger

Track Path to Glory warbands, units, Glory Points, battles, Battle Scars, quests, and Arcane Tome entries. Export a warband as a standalone HTML file with printable datacards.

## Run and verify

Open [the app](dist/index.html) in a modern browser. The complete static site lives in `dist/` and needs no build or server. Run `node tools/check.mjs` from the repository root to check the app routes, shipped assets, exports, and backup compatibility. The check uses Node.js and has no package dependencies.

On first launch, **Start the campaign** lets you enter the same campaign details available in **Settings** or import a JSON backup.

Campaigns are stored in the browser. Export a **JSON backup** and import it at the new address when moving from a local copy or the private hosted site to GitLab Pages. Backups contain campaign data, so keep them outside `dist/` and the public repository.

## Source map

Follow the file link, then search for the symbol or CSS selector in the last column.

| To change | Open | Search for |
| --- | --- | --- |
| Routes, navigation, or the Active warband | [App](dist/app.js), [selectors](dist/domain/selectors.js), [script order](dist/index.html) | `const pages`, `selectWarband`, `viewedArmy` |
| Unit cards, editor, or resource adjustments | [Warbands](dist/features/warbands.js) | `unitCard`, `unitForm`, `resourceForm` |
| Anvil choices, upgrades, or custom profiles | [Anvil editor](dist/features/anvil-hero.js), [upgrades](dist/features/unit-upgrades.js), [profile editor](dist/features/unit-profile-editor.js) | `mountAnvilEditor`, `mountUnitUpgrades`, `attachProfileEditor` |
| Spells, prayers, and manifestations | [Arcane Tome](dist/features/arcane-tome.js) | `loreCard`, `loreEntryForm`, `arcaneTomeActions` |
| Battle results, Renown, or Battle Scars | [Battles](dist/features/battles.js), [Ledger model](dist/domain/ledger.js) | `battleForm`, `unitBattleScars` |
| Overview, quests, chronicle, or settings | [Campaign](dist/features/campaign.js) | `overview`, `quests`, `chronicle`, `settings` |
| Card fields, export content, or print selection | [Datacards](dist/features/datacards.js) | `datacard`, `loreDatacard`, `warbandDatacards`, `printChoice` |
| Export colors, columns, or print layout | [Datacard styles](dist/ui/datacard-styles.js) | `datacardStyles`, `datacardExportStyles` |
| In-app colors, unit card design, or lore card design | [App styles](dist/assets/styles.css), [campaign card styles](dist/assets/campaign-cards.css) | `:root`, `.unit-card`, `.lore-entry-card` |
| Roster points, Glory Points, or backup conversion | [Ledger model](dist/domain/ledger.js), [browser store](dist/storage/campaign-store.js) | `points`, `transactions`, `normalize` |
| Profile matching or catalogue search | [Profile matching](dist/domain/unit-profiles.js), [profile library](dist/features/profile-library.js), [search picker](dist/ui/text-picker.js) | `unitCatalogueEntry`, `libraryResults`, `mountTextPicker` |
| Shared controls, dialogs, or file downloads | [UI components](dist/ui/components.js), [dialogs](dist/ui/dialogs.js), [downloads](dist/storage/downloads.js) | `field`, `formDialog`, `downloadFile` |

The app loads scripts in dependency order, with `app.js` last. The downloaded datacard HTML embeds its styles and opens offline. When changing a record shape, update `Ledger.normalize` and verify that older JSON backups still load.

## Maintenance tools

- [check.mjs](tools/check.mjs) validates the current app and its data.
- [sync_wahapedia.py](tools/sync_wahapedia.py) downloads Wahapedia's documented AoS 4 CSV export and writes a JSON manifest, one JSON file per faction, and the browser catalogue used by the deployed ledger. It uses only Python's standard library and runs automatically before every GitHub Pages deployment.
- [build_catalogue.py](tools/build_catalogue.py) regenerates the shipped catalogue from a Battle Profiles PDF and a Wahapedia CSV export. It uses `pdfplumber`.
- [update_khazalite_warscrolls.py](tools/update_khazalite_warscrolls.py) applies Khazalite Holds profile details from a saved faction warscroll page. It uses `lxml`.

Run the two Python tools in this order when refreshing the catalogue. Keep the input downloads outside the published directory.

To reproduce the deployment-time Wahapedia import locally, run:

```text
python tools/sync_wahapedia.py
node tools/check.mjs
```

The CSV faction list can lag behind live faction pages. The importer also discovers factions present in the bundled catalogue (such as Khazalite Holds), fetches their own live faction rules, and retains their bundled warscrolls. The manifest marks those warscrolls with `warscrollSource: "bundled catalogue"`. Once the faction appears in the CSV, its export records take precedence. Run `python tools/test_sync_wahapedia.py` for the offline faction-discovery regression check.

Manifestation lores are imported from canonical faction pages and the shared Endless Spells page. Summoning entries link to their manifestation warscrolls. Units with blank export costs are included as zero-point manifestations; missing profiles are fetched from their individual reference pages. The catalogue offers shared lores and units alongside faction-specific choices. Manifestation characteristics include Banishment, and both casting and chanting values are retained.

New warbands can choose one spell, prayer, and manifestation lore during creation, plus faction traits and formation abilities. Existing warbands use **Import faction rules** on the Warbands page or in Battle Traits. This adds missing records while preserving customizations and avoiding duplicates, including older backups without lore/trait collections. Linked manifestation units can optionally be added to the roster. Custom items and all existing editors remain available.

The generated JSON manifest is `dist/data/wahapedia/index.json`; faction files are under `dist/data/wahapedia/factions/`. The importer reads faction rules and separate Army of Renown battle-trait lists. Spearhead and embedded errata cards are excluded. Battle Traits groups saved records by standard faction, Army of Renown, formation abilities, and custom traits. **Import full trait list** offers the warband's standard faction and its Armies of Renown, preserving existing edits on repeated imports. Trait ruleset metadata survives backups; older records are matched to a source when unambiguous. Army of Renown traits replace standard faction traits in play; storing both lists does not make both eligible. Other Army of Renown rules such as lores and enhancements are not imported by this feature.

Dropdown labels and text-picker choices use title case while retaining their original selection values. All imported records remain editable copies, and custom items remain available. The deployment fails instead of publishing stale or structurally invalid data when a download or schema validation fails.

```text
python tools/build_catalogue.py <battle-profiles.pdf> <csv-folder> dist/data/battle-catalogue-data.js
python tools/update_khazalite_warscrolls.py dist/data/battle-catalogue-data.js <warscrolls.html> --retrieved <YYYY-MM-DD>
```

Use `--abilities-only` in place of `--retrieved` and its date to refresh abilities alone on an existing catalogue. Check the generated diff and rerun `node tools/check.mjs` before publishing.

## Publish with GitLab Pages

Set your GitLab Pages job to publish `dist/`. For example, add this job to your GitLab project's `.gitlab-ci.yml` to publish manually from the default branch after the checks pass.

```yaml
deploy-pages:
  image: node:24
  script:
    - node tools/check.mjs
  pages:
    publish: dist
  rules:
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'
      when: manual
```

Find the published URL under **Deploy → Pages**. [GitLab Pages documentation](https://docs.gitlab.com/user/project/pages/introduction/#customize-the-default-folder)
