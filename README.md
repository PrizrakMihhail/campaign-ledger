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
- [build_catalogue.py](tools/build_catalogue.py) regenerates the shipped catalogue from a Battle Profiles PDF and a Wahapedia CSV export. It uses `pdfplumber`.
- [update_khazalite_warscrolls.py](tools/update_khazalite_warscrolls.py) applies Khazalite Holds profile details from a saved faction warscroll page. It uses `lxml`.

Run the two Python tools in this order when refreshing the catalogue. Keep the input downloads outside the published directory.

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
