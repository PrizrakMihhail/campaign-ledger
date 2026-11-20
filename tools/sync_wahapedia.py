"""Download Wahapedia's AoS 4 export and build deployable faction catalogues.

The importer uses the documented CSV export for warscrolls and canonical faction
HTML pages for faction rules. It has no third-party dependencies.
"""

from __future__ import annotations

import argparse
import csv
import html
import io
import json
import re
import sys
import time
import unicodedata
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


BASE_URL = "https://wahapedia.ru/aos4/"
EXPORTS = (
    "Last_update",
    "Factions",
    "Source",
    "Warscrolls",
    "Warscrolls_abilities",
    "Warscrolls_keywords",
    "Warscrolls_weapons",
)
REQUIRED_COLUMNS = {
    "Last_update": {"last_update"},
    "Factions": {"id", "name", "link"},
    "Source": {"id", "name", "type", "edition"},
    "Warscrolls": {
        "id", "name", "faction_id", "source_id", "role", "virtual", "no_reinforced", "link",
        "legend", "regiment_options", "notes", "description",
        "Move", "Save", "Control", "Health", "Ward", "UnitSize", "Cost",
    },
    "Warscrolls_abilities": {"warscroll_id", "line", "name", "description", "condition"},
    "Warscrolls_keywords": {"warscroll_id", "keyword", "parameter"},
    "Warscrolls_weapons": {
        "warscroll_id", "line", "name", "Rng", "Atk", "Hit", "Wnd", "Rnd", "Dmg", "type", "abilities",
    },
}


def clean(value: str | None) -> str:
    return " ".join((value or "").replace("\u00ad", "").split())


def key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", value).casefold())


def slug(value: str) -> str:
    result = re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", value).casefold()).strip("-")
    if not result:
        raise ValueError(f"Cannot create a file name for faction {value!r}")
    return result


class _TextExtractor(HTMLParser):
    block_tags = {"br", "div", "p", "li", "ul", "ol"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self.block_tags:
            self.parts.append("\n")
        if tag == "li":
            self.parts.append("• ")

    def handle_endtag(self, tag: str) -> None:
        if tag in self.block_tags:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def plain(value: str | None) -> str:
    parser = _TextExtractor()
    parser.feed(html.unescape(value or ""))
    return "\n".join(clean(line) for line in "".join(parser.parts).splitlines() if clean(line))


def download(name: str, *, attempts: int = 3, timeout: int = 45) -> bytes:
    return download_url(BASE_URL + name + ".csv", attempts=attempts, timeout=timeout)


def download_url(url: str, *, attempts: int = 3, timeout: int = 45) -> bytes:
    request = Request(url, headers={"User-Agent": "Path-to-Glory-Campaign-Ledger/1.0 (+GitHub Pages build)"})
    for attempt in range(1, attempts + 1):
        try:
            with urlopen(request, timeout=timeout) as response:
                if response.status != 200:
                    raise RuntimeError(f"{url} returned HTTP {response.status}")
                content = response.read(30_000_001)
                if len(content) > 30_000_000:
                    raise RuntimeError(f"{url} exceeded the 30 MB safety limit")
                if not content:
                    raise RuntimeError(f"{url} returned an empty file")
                return content
        except (HTTPError, URLError, TimeoutError, OSError) as error:
            if attempt == attempts:
                raise RuntimeError(f"Could not download {url}: {error}") from error
            time.sleep(attempt * 2)
    raise AssertionError("unreachable")


def section_html(page: str, section_id: str) -> str:
    start = re.search(rf'<h2\b[^>]*\bid=["\']{re.escape(section_id)}["\'][^>]*>', page, re.I)
    if not start:
        return ""
    following = page[start.end():]
    end = re.search(r"<h2\b", following, re.I)
    section = following[:end.start()] if end else following
    # Errata sometimes embeds replacement ability cards. The main rule above it
    # is already current, so do not import those cards a second time.
    errata = re.search(r'<h3\b[^>]*\bid=["\']Errata(?:-[^"\']*)?["\']', section, re.I)
    return section[:errata.start()] if errata else section


def div_contents(source: str, opening: re.Match) -> tuple[str, int]:
    opening_end = source.find(">", opening.start())
    if opening_end < 0:
        raise ValueError("Unterminated ability body tag")
    depth = 1
    for tag in re.finditer(r"</?div\b[^>]*>", source[opening_end + 1:], re.I):
        depth += -1 if tag.group(0).startswith("</") else 1
        if depth == 0:
            end = opening_end + 1 + tag.start()
            return source[opening_end + 1:end], opening_end + 1 + tag.end()
    raise ValueError("Unterminated ability body")


def html_fragment_text(fragment: str) -> str:
    return plain(re.sub(r"<script\b.*?</script>|<style\b.*?</style>", "", fragment, flags=re.I | re.S))


def split_rule_text(value: str) -> tuple[str, str]:
    declare = ""
    effect = ""
    current = "effect"
    buckets = {"declare": [], "effect": []}
    for line in value.splitlines():
        match = re.match(r"^(Declare|Effect):\s*(.*)$", line, re.I)
        if match:
            current = match.group(1).lower()
            if match.group(2):
                buckets[current].append(match.group(2))
        else:
            buckets[current].append(line)
    declare = "\n".join(buckets["declare"]).strip()
    effect = "\n".join(buckets["effect"]).strip()
    return declare, effect


def section_abilities(section: str) -> list[dict]:
    if not section:
        return []
    for opening in reversed(list(re.finditer(r'<div\b[^>]*class=["\'][^"\']*\bfaqErrataSpoilerBody\b[^"\']*["\'][^>]*>', section, re.I))):
        _, end = div_contents(section, opening)
        section = section[:opening.start()] + section[end:]
    headings = []
    for heading in re.finditer(r"<h3\b[^>]*>(.*?)</h3>", section, re.I | re.S):
        headings.append((heading.start(), html_fragment_text(heading.group(1))))
    bodies = list(re.finditer(r'<div\b[^>]*\bclass=["\'][^"\']*\babBody\b[^"\']*["\'][^>]*>', section, re.I))
    result = []
    previous_end = 0
    for opening in bodies:
        body, end = div_contents(section, opening)
        prefix = section[previous_end:opening.start()]
        headers = re.findall(r'<td\b[^>]*\bclass=["\'][^"\']*\babHeader\b[^"\']*["\'][^>]*>(.*?)</td>', prefix, re.I | re.S)
        timing = html_fragment_text(headers[-1]) if headers else ""
        values = re.findall(r'<div\b[^>]*\bclass=["\'][^"\']*\bab(?:Spell|Prayer)PointsN\b[^"\']*["\'][^>]*>(.*?)</div>', prefix, re.I | re.S)
        value = html_fragment_text(values[-1]) if values else ""
        keyword_match = re.search(r'<td\b[^>]*\bclass=["\'][^"\']*\babKeywordsBodyText\b[^"\']*["\'][^>]*>(.*?)</td>', body, re.I | re.S)
        keywords = [clean(item) for item in html_fragment_text(keyword_match.group(1)).split(",")] if keyword_match else []

        without_fluff = re.sub(r'<span\b[^>]*\bclass=["\'][^"\']*\bShowFluff\b[^"\']*["\'][^>]*>.*?</span>', "", body, flags=re.I | re.S)
        name_match = re.search(r"<b\b[^>]*>(.*?)</b>", without_fluff, re.I | re.S)
        if not name_match:
            previous_end = end
            continue
        name = html_fragment_text(name_match.group(1)).rstrip(":")
        rules = without_fluff[name_match.end():]
        rules = re.split(r'<div\b[^>]*\bclass=["\'][^"\']*\babKeywords\b', rules, maxsplit=1, flags=re.I)[0]
        declare, effect = split_rule_text(html_fragment_text(rules))
        group = next((label for position, label in reversed(headings) if position < opening.start()), "")
        record = {"name": name, "timing": timing, "declare": declare, "effect": effect}
        if group:
            record["group"] = group
        if value:
            record["value"] = value
        if keywords:
            record["keywords"] = keywords
        record["unitLinks"] = list(dict.fromkeys(
            "https://wahapedia.ru" + link if link.startswith("/") else link
            for link in re.findall(r'href=["\']([^"\']+)["\']', body)
            if re.match(r"(?:https://wahapedia.ru)?/aos4/factions/[^/]+/[^/#]+$", link)
        ))
        result.append(record)
        previous_end = end
    return result


def grouped_rules(abilities: list[dict], kind: str) -> list[dict]:
    groups: dict[str, list[dict]] = {}
    for ability in abilities:
        group = ability.pop("group", "")
        if not group:
            continue
        groups.setdefault(group, []).append(ability)
    return [{"name": name, "kind": kind, "points": 0, "entries": entries} for name, entries in groups.items()]


def parse_faction_rules(page: bytes) -> dict:
    document = page.decode("utf-8-sig", errors="strict")
    traits = section_abilities(section_html(document, "Battle-Traits"))
    formation_abilities = section_abilities(section_html(document, "Battle-Formations"))
    formations: dict[str, list[dict]] = {}
    for ability in formation_abilities:
        group = ability.pop("group", "")
        if group:
            formations.setdefault(group, []).append(ability)
    armies = []
    headings = list(re.finditer(r'<h2\b[^>]*>(.*?)</h2>', document, re.I | re.S))
    for index, heading in enumerate(headings):
        name = html_fragment_text(heading.group(1))
        if name.upper() == "SPEARHEAD":
            break
        block = document[heading.end():headings[index + 1].start() if index + 1 < len(headings) else len(document)]
        trait_heading = re.search(r'<h3\b[^>]*\bid=["\']Battle-Traits-\d+["\'][^>]*>', block, re.I)
        if not trait_heading or "Army of Renown" not in html_fragment_text(block[:trait_heading.start()]):
            continue
        following = block[trait_heading.end():]
        end = re.search(r'<h3\b[^>]*\bid=["\'](?!Errata)[^"\']+["\']', following, re.I)
        army_traits = section_abilities(following[:end.start()] if end else following)
        if army_traits:
            armies.append({"id": slug(name), "name": name, "battleTraits": army_traits})
    return {
        "battleTraits": traits,
        "armiesOfRenown": armies,
        "battleFormations": [{"name": name, "abilities": abilities} for name, abilities in formations.items()],
        "lores": {
            "spell": grouped_rules(section_abilities(section_html(document, "Spell-Lore")), "spell"),
            "prayer": grouped_rules(section_abilities(section_html(document, "Prayer-Lore")), "prayer"),
            "manifestation": grouped_rules([ability for ability in section_abilities(section_html(document, "Manifestation-Lore")) if ability["name"].upper().startswith("SUMMON ")], "manifestation"),
        },
    }


def parse_export(name: str, content: bytes) -> list[dict[str, str]]:
    text = content.decode("utf-8-sig")
    if name == "Warscrolls":
        # Some HTML fields contain unquoted newlines. Records always start with a
        # nine-digit id, so fold only those embedded line breaks.
        records = re.split(r"\r?\n(?=\d{9}\|)", text)
        text = "\n".join(record.strip().replace("\r", "").replace("\n", " ") for record in records)
    reader = csv.DictReader(io.StringIO(text), delimiter="|")
    columns = set(reader.fieldnames or ())
    missing = REQUIRED_COLUMNS[name] - columns
    if missing:
        raise ValueError(f"{name}.csv is missing columns: {', '.join(sorted(missing))}")
    rows = []
    for number, row in enumerate(reader, 2):
        if None in row:
            raise ValueError(f"{name}.csv row {number} has more fields than its header")
        if row.get("") not in (None, ""):
            raise ValueError(f"{name}.csv row {number} has data in its trailing column")
        row.pop("", None)
        rows.append({column: value or "" for column, value in row.items()})
    if not rows:
        raise ValueError(f"{name}.csv contains no records")
    return rows


def grouped(rows: list[dict[str, str]], convert) -> dict[str, list]:
    result: dict[str, list] = defaultdict(list)
    for row in rows:
        value = convert(row)
        if value is not None and value not in result[row["warscroll_id"]]:
            result[row["warscroll_id"]].append(value)
    return result


def category(role: str, keywords: list[str]) -> str:
    combined = (role + " " + " ".join(keywords)).lower()
    if "hero" in combined:
        return "Hero"
    for word, label in (
        ("war machine", "War Machine"),
        ("faction terrain", "Terrain"),
        ("terrain", "Terrain"),
        ("manifestation", "Manifestation"),
        ("endless spell", "Manifestation"),
        ("cavalry", "Cavalry"),
        ("infantry", "Infantry"),
        ("monster", "Monster"),
    ):
        if word in combined:
            return label
    return "Other"


def source_kind(source: str, notes: str) -> str:
    context = (source + " " + notes).lower()
    if "legends" in context:
        return "Legends"
    for expansion in ("Scourge of Aqshy", "Scourge of Ghyran"):
        if source.startswith(expansion):
            return expansion
    return ""


def build(exports: dict[str, list[dict[str, str]]]) -> tuple[str, list[dict], list[dict]]:
    update = clean(exports["Last_update"][0]["last_update"])
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}", update):
        raise ValueError(f"Unexpected Last_update value: {update!r}")
    factions = {row["id"]: row for row in exports["Factions"]}
    sources = {row["id"]: row for row in exports["Source"]}

    keywords = grouped(exports["Warscrolls_keywords"], lambda row: (
        clean(row["keyword"]) + (f" ({clean(row['parameter'])})" if clean(row["parameter"]) else "")
    ) if clean(row["keyword"]) else None)

    def ability(row: dict[str, str]) -> dict | None:
        name = plain(row["name"])
        effect = plain(row["description"])
        if not name or not effect:
            return None
        result = {"name": name, "timing": plain(row["condition"]), "effect": effect, "kind": "Ability"}
        for source_field, output_field in (
            ("ability_type", "type"), ("keywords", "keywords"), ("ability_phase", "phase"),
            ("points_type", "pointsType"), ("points", "points"),
        ):
            value = plain(row.get(source_field, ""))
            if value:
                result[output_field] = value
        if row.get("is_reaction", "").lower() == "true":
            result["reaction"] = True
        return result

    abilities = grouped(exports["Warscrolls_abilities"], ability)

    def weapon(row: dict[str, str]) -> tuple[str, list[str]] | None:
        name = clean(row["name"])
        kind = row["type"].lower()
        if not name or kind not in {"melee", "ranged"}:
            return None
        fields = (["Rng"] if kind == "ranged" else []) + ["Atk", "Hit", "Wnd", "Rnd", "Dmg"]
        values = [plain(row[field]) or "—" for field in fields]
        traits = plain(row["abilities"])
        if row.get("has_battle_damage", "").lower() == "true":
            traits = " · ".join(filter(None, (traits, "See battle damage rules")))
        return kind, [name, *values, traits]

    weapons = grouped(exports["Warscrolls_weapons"], weapon)
    entries: list[dict] = []
    seen: set[tuple[str, str, str]] = set()
    faction_counts: dict[str, int] = defaultdict(int)
    for row in exports["Warscrolls"]:
        faction = factions.get(row["faction_id"])
        if not faction or row["virtual"].lower() == "true" or not clean(row["Health"]):
            continue
        is_manifestation = row["faction_id"] == "EnS" or category(row["role"], keywords[row["id"]]) == "Manifestation"
        if (not row["Cost"].isdigit() and not (is_manifestation and not row["Cost"].strip())) or not row["UnitSize"].isdigit():
            continue
        source = sources.get(row["source_id"], {})
        source_name = clean(source.get("name", ""))
        link = clean(row["link"])
        context = (source_name + " " + link + " " + row["role"]).lower()
        if "spearhead" in context or row["role"].lower() == "regiment of renown":
            continue

        faction_name = clean(faction["name"])
        name = clean(row["name"])
        kind = source_kind(source_name, row.get("notes", ""))
        if kind.startswith("Scourge of ") and not name.startswith(kind):
            name = f"{kind} {name}"
        identity = (key(faction_name), key(name), kind)
        if identity in seen:
            raise ValueError(f"Duplicate exported warscroll: {faction_name} / {name} / {kind or 'standard'}")
        seen.add(identity)

        unit_id = row["id"]
        profile = {
            field.lower(): clean(row[field])
            for field in ("Move", "Health", "Save", "Control", "Ward")
            if clean(row[field])
        }
        if is_manifestation and "control" in profile:
            profile["banishment"] = profile.pop("control")
        profile.update({
            "url": link,
            "retrieved": update.split()[0],
            "keywords": keywords[unit_id],
            "abilities": [item["name"] for item in abilities[unit_id]],
            "abilityDetails": abilities[unit_id],
        })
        for weapon_kind, values in weapons[unit_id]:
            profile.setdefault(weapon_kind, []).append(values)
        entry = {
            "faction": faction_name,
            "name": name,
            "points": int(row["Cost"]) if row["Cost"].isdigit() else 0,
            "size": int(row["UnitSize"]),
            "kind": kind,
            "category": "Manifestation" if is_manifestation else category(row["role"], keywords[unit_id]),
            "profile": profile,
            "source": source_name,
            "canReinforce": row["no_reinforced"].lower() != "true",
        }
        for source_field, output_field in (
            ("legend", "flavour"), ("regiment_options", "regimentOptions"),
            ("notes", "notes"), ("description", "description"),
        ):
            value = plain(row[source_field])
            if value:
                entry[output_field] = value
        entries.append(entry)
        faction_counts[faction_name] += 1

    faction_records = []
    for faction in sorted(factions.values(), key=lambda item: item["name"].casefold()):
        name = clean(faction["name"])
        count = faction_counts[name]
        if count:
            faction_records.append({"id": faction["id"], "name": name, "slug": slug(name), "url": clean(faction["link"]), "count": count})
    entries.sort(key=lambda item: (item["faction"].casefold(), item["name"].casefold(), item["kind"]))
    return update, faction_records, entries


def fetch_all_rules(factions: list[dict]) -> dict[str, dict]:
    rules: dict[str, dict] = {}

    def fetch(faction: dict) -> tuple[str, dict]:
        url = faction["url"].rstrip("/") + "/"
        return faction["name"], parse_faction_rules(download_url(url))

    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(fetch, faction): faction["name"] for faction in factions}
        for future in as_completed(futures):
            name, faction_rules = future.result()
            rules[name] = faction_rules

    armies = [name for name in rules if name != "Endless Spells"]
    missing = [name for name in armies if not rules[name]["battleTraits"] or not rules[name]["battleFormations"]]
    if missing:
        raise ValueError("Canonical faction rules were not found for: " + ", ".join(sorted(missing)))
    if not any(rule["lores"]["spell"] for rule in rules.values()):
        raise ValueError("No spell lores were parsed from faction pages")
    if not any(rule["lores"]["prayer"] for rule in rules.values()):
        raise ValueError("No prayer lores were parsed from faction pages")
    return rules


def include_bundled_factions(factions: list[dict], entries: list[dict], catalogue: Path) -> None:
    """Discover newer factions missing from the upstream CSV snapshot.

    Keep their bundled warscroll snapshot, but fetch their rules from their own
    canonical page. Do not alias a new faction to an older faction's rules.
    """
    text = catalogue.read_text(encoding="utf-8-sig")
    bundled = json.loads(text.split("entries: ", 1)[1].rsplit("}", 1)[0])
    known = {key(faction["name"]) for faction in factions}
    by_faction: dict[str, list[dict]] = defaultdict(list)
    for entry in bundled:
        by_faction[entry["faction"]].append(entry)
    for name, records in sorted(by_faction.items()):
        if key(name) in known:
            continue
        canonical = BASE_URL + "factions/" + slug(name)
        if not any((record.get("profile", {}).get("url", "") + "/").startswith(canonical + "/") for record in records):
            continue
        factions.append({
            "id": "bundled:" + slug(name), "name": name, "slug": slug(name),
            "url": canonical, "count": len(records), "warscrollSource": "bundled catalogue",
        })
        entries.extend(records)
        known.add(key(name))
        print(f"{name}: absent from CSV export; using {len(records)} bundled warscrolls and fetching live faction rules.")
    factions.sort(key=lambda faction: faction["name"].casefold())
    entries.sort(key=lambda entry: (entry["faction"].casefold(), entry["name"].casefold(), entry["kind"]))


class _Node:
    def __init__(self, tag="", attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def text(self):
        return clean("".join(child.text() if isinstance(child, _Node) else child for child in self.children))

    def find(self, class_name):
        return [node for node in self.walk() if class_name in node.attrs.get("class", "").split()]

    def walk(self):
        for child in self.children:
            if isinstance(child, _Node):
                yield child
                yield from child.walk()


class _Tree(HTMLParser):
    def __init__(self, page):
        super().__init__(convert_charrefs=True)
        self.root = _Node()
        self.stack = [self.root]
        self.feed(page)

    def handle_starttag(self, tag, attrs):
        node = _Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def manifestation_profile(page: bytes, url: str, faction: str, name: str) -> dict:
    document = page.decode("utf-8-sig")
    tree = _Tree(document).root
    sheets = tree.find("datasheet")
    sheet = next((node for node in sheets if node.find("wsHeaderIn") and key(node.find("wsHeaderIn")[0].text()) == key(name)), None)
    if sheet is None:
        raise ValueError(f"Manifestation warscroll not found: {url}")
    stats = {}
    for field, class_name in {"move": "wsMove", "health": "wsWounds", "save": "wsSave", "banishment": "wsBravery", "ward": "wsWard"}.items():
        nodes = sheet.find(class_name)
        if nodes:
            stats[field] = nodes[0].text() or ("*" if any("asterix" in node.attrs.get("src", "") for node in nodes[0].walk()) else "")
    if not stats.get("health"):
        raise ValueError(f"Manifestation health not found: {url}")
    keywords = [clean(word) for line in sheet.find("wsKeywordLine1") + sheet.find("wsKeywordLine2") for word in line.text().split(",") if clean(word)]
    # Individual unit pages contain navigation and rules references too. Restrict
    # ability parsing to the matching datasheet's HTML fragment.
    opening = next((match for match in re.finditer(r'<div\b[^>]*class=["\'][^"\']*\bdatasheet\b[^"\']*["\'][^>]*>', document) if key(name) in key(document[match.end():match.end() + 600])), None)
    if not opening:
        raise ValueError(f"Manifestation datasheet boundary not found: {url}")
    fragment, _ = div_contents(document, opening)
    details = section_abilities(fragment)
    profile = {**stats, "url": url, "keywords": keywords, "abilityDetails": details, "abilities": [item["name"] for item in details]}
    for table in sheet.find("wTable"):
        kind = None
        for row in (node for node in table.walk() if node.tag == "tr"):
            if row.find("wsHeaderCellName_RangedWeapons"):
                kind = "ranged"
            elif row.find("wsHeaderCellName_MeleeWeapons"):
                kind = "melee"
            elif kind and row.find("wsCell"):
                labels = row.find("wsDataCell_long")
                if not labels:
                    continue
                label = labels[-1]
                weapon_name = clean("".join(child for child in label.children if isinstance(child, str)))
                values = [cell.text() for cell in row.find("wsCell")][- (6 if kind == "ranged" else 5):]
                traits = " · ".join(node.text() for node in label.find("wsWeaponAbility"))
                profile.setdefault(kind, []).append([weapon_name, *values, traits])
    return {"faction": faction, "name": sheet.find("wsHeaderIn")[0].text(), "points": 0, "size": 1, "kind": "", "category": "Manifestation", "profile": profile, "canReinforce": False}


def link_manifestations(factions: list[dict], entries: list[dict], rules: dict[str, dict]) -> None:
    def unit_key(value):
        return key(re.sub(r"^the[ -]", "", value, flags=re.I))
    for faction in factions:
        name = faction["name"]
        for lore in rules[name]["lores"].get("manifestation", []):
            lore["scope"] = "shared" if name == "Endless Spells" else "faction"
            for summon in lore["entries"]:
                unit_name = re.sub(r"^SUMMON\s+", "", summon["name"], flags=re.I)
                matches = [entry for entry in entries if entry["faction"] == name and unit_key(entry["name"]) == unit_key(unit_name)]
                if not matches:
                    links = [link for link in summon.get("unitLinks", []) if unit_key(link.rsplit("/", 1)[-1]) == unit_key(unit_name)]
                    if not links:
                        raise ValueError(f"No manifestation reference for {name}: {summon['name']}")
                    entry = manifestation_profile(download_url(links[0]), links[0], name, unit_name.title())
                    entries.append(entry)
                    matches = [entry]
                entry = matches[0]
                entry["category"] = "Manifestation"
                summon["manifestation"] = {"faction": name, "name": entry["name"]}
        faction["count"] = sum(entry["faction"] == name for entry in entries)
    entries.sort(key=lambda entry: (entry["faction"].casefold(), entry["name"].casefold(), entry["kind"]))


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(content, encoding="utf-8", newline="\n")
    temporary.replace(path)


def write_outputs(output: Path, javascript: Path, update: str, factions: list[dict], entries: list[dict], rules: dict[str, dict]) -> None:
    compact = lambda value: json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    by_faction: dict[str, list[dict]] = defaultdict(list)
    for entry in entries:
        by_faction[entry["faction"]].append(entry)
    manifest = {"edition": "Age of Sigmar 4", "lastUpdate": update, "factions": factions, "entryCount": len(entries)}
    atomic_write(output / "index.json", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    for faction in factions:
        payload = {"edition": "Age of Sigmar 4", "lastUpdate": update, "faction": faction, "rules": rules[faction["name"]], "entries": by_faction[faction["name"]]}
        atomic_write(output / "factions" / f"{faction['slug']}.json", json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    js_payload = {"edition": "Age of Sigmar 4", "warscrollDate": update.split()[0], "rules": rules, "entries": entries}
    atomic_write(javascript, "// Generated during deployment by tools/sync_wahapedia.py.\nconst WahapediaCatalogueData = " + compact(js_payload) + ";\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build AoS 4 faction JSON files from Wahapedia's official CSV export.")
    parser.add_argument("--output", type=Path, default=Path("dist/data/wahapedia"), help="Directory for the JSON manifest and faction files")
    parser.add_argument("--javascript", type=Path, default=Path("dist/data/wahapedia-catalogue-data.js"), help="Browser catalogue generated from the same records")
    parser.add_argument("--bundled-catalogue", type=Path, default=Path("dist/data/battle-catalogue-data.js"), help="Bundled catalogue used to discover newer factions missing from the CSV export")
    args = parser.parse_args()
    try:
        exports = {name: parse_export(name, download(name)) for name in EXPORTS}
        update, factions, entries = build(exports)
        include_bundled_factions(factions, entries, args.bundled_catalogue)
        rules = fetch_all_rules(factions)
        link_manifestations(factions, entries, rules)
        write_outputs(args.output, args.javascript, update, factions, entries, rules)
    except (RuntimeError, ValueError, UnicodeError) as error:
        print(f"Wahapedia sync failed: {error}", file=sys.stderr)
        return 1
    print(f"Wahapedia {update}: wrote {len(entries)} warscrolls and canonical rules across {len(factions)} factions.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
