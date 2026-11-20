"""Offline regression checks for faction discovery."""

import unittest
from pathlib import Path

from sync_wahapedia import include_bundled_factions, parse_faction_rules, manifestation_profile, link_manifestations


class FactionDiscoveryTests(unittest.TestCase):
    def test_army_of_renown_traits_are_separate_from_standard_and_spearhead(self):
        card = '<table><td class="abHeader">Passive</td></table><div class="abBody"><b>{}</b><br>Effect: Test.</div>'
        page = '<h2 id="Battle-Traits">Battle Traits</h2>' + card.format('STANDARD')
        page += '<h2 id="test-army">Test Army</h2><p>Choose this Army of Renown.</p><h3 id="Battle-Traits-1">Battle Traits</h3>' + card.format('ARMY')
        page += '<h3 id="Heroic-Traits">Heroic Traits</h3>' + card.format('HEROIC')
        page += '<h2 id="SPEARHEAD">SPEARHEAD</h2><p>Army of Renown</p><h3 id="Battle-Traits-2">Battle Traits</h3>' + card.format('SPEARHEAD')
        rules = parse_faction_rules(page.encode())
        self.assertEqual([item['name'] for item in rules['battleTraits']], ['STANDARD'])
        self.assertEqual(len(rules['armiesOfRenown']), 1)
        self.assertEqual([item['name'] for item in rules['armiesOfRenown'][0]['battleTraits']], ['ARMY'])

    def test_manifestation_prayer_value_and_profile_link(self):
        page = b'''<h2 id="Manifestation-Lore">Manifestation Lore</h2>
        <h3>Magmic Invocations</h3><table><td class="abHeader">Your Hero Phase</td>
        <div class="abPrayerPointsN">4</div></table><div class="abBody"><b>SUMMON RUNIC FYREWALL</b>
        <b>Declare:</b> Choose a priest.<br><b>Effect:</b> Set up the wall.
        <a href="/aos4/factions/khazalite-holds/Runic-Fyrewall">Runic Fyrewall</a></div>
        <h2>Other rules</h2>'''
        rules = {"Khazalite Holds": parse_faction_rules(page)}
        summons = rules["Khazalite Holds"]["lores"]["manifestation"][0]["entries"]
        self.assertEqual(summons[0]["value"], "4")
        units = [{"name": "Runic Fyrewall", "faction": "Khazalite Holds", "kind": ""}]
        link_manifestations([{"name": "Khazalite Holds"}], units, rules)
        self.assertEqual(units[0]["category"], "Manifestation")
        self.assertEqual(summons[0]["manifestation"]["name"], "Runic Fyrewall")

    def test_special_health_and_banishment(self):
        page = b'''<div class="datasheet"><div class="wsHeaderIn">Dais Arcanum</div>
        <div class="wsWounds"><img src="/aos4/img/asterix.png"></div>
        <div class="wsBravery">7+</div><table><td class="abHeader">Passive</td></table>
        <div class="abBody"><b>TEST ABILITY</b><br><b>Effect:</b> Test effect.</div></div>'''
        unit = manifestation_profile(page, "https://wahapedia.ru/aos4/factions/stormcast-eternals/Dais-Arcanum", "Stormcast Eternals", "Dais Arcanum")
        self.assertEqual(unit["profile"]["health"], "*")
        self.assertEqual(unit["profile"]["banishment"], "7+")
        self.assertEqual(unit["profile"]["abilityDetails"][0]["name"], "TEST ABILITY")

    def test_discovers_khazalite_without_relabeling_fyreslayers(self):
        factions = [{"id": "FY", "name": "Fyreslayers"}]
        entries = [{"faction": "Fyreslayers", "name": "Original", "kind": ""}]
        catalogue = Path(__file__).resolve().parents[1] / "dist/data/battle-catalogue-data.js"
        include_bundled_factions(factions, entries, catalogue)
        khazalite = next(faction for faction in factions if faction["name"] == "Khazalite Holds")
        self.assertEqual(khazalite["url"], "https://wahapedia.ru/aos4/factions/khazalite-holds")
        self.assertEqual(khazalite["warscrollSource"], "bundled catalogue")
        self.assertGreater(khazalite["count"], 0)
        self.assertTrue(any(entry["faction"] == "Fyreslayers" and entry["name"] == "Original" for entry in entries))
        self.assertFalse(any(faction["name"] == "White Dwarf" for faction in factions))
        before = (len(factions), len(entries))
        include_bundled_factions(factions, entries, catalogue)
        self.assertEqual((len(factions), len(entries)), before)


if __name__ == "__main__":
    unittest.main()
