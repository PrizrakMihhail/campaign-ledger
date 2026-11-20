import argparse
import csv
import html
import io
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import pdfplumber


def key(value):
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', value).casefold())


def clean(value):
    return ' '.join((value or '').replace('\x07', '').replace('\u00ad', '').split())


def plain(value):
    return clean(html.unescape(re.sub(r'<[^>]*>', '', value or '')))


def read_export(folder, filename):
    with (folder / (filename + '.csv')).open(encoding='utf-8-sig', newline='') as file:
        if filename == 'Warscrolls':
            # The export occasionally contains unquoted line breaks inside a warscroll.
            rows = re.split(r'\r?\n(?=\d{9}\|)', file.read())
            file = io.StringIO('\n'.join(row.strip().replace('\r', '').replace('\n', ' ') for row in rows))
        reader = csv.DictReader(file, delimiter='|')
        return [row for row in reader if None not in row and row.get('') == '']


def category(value, hero=False):
    if hero:
        return 'Hero'
    return next((label for word, label in (
        ('infantry', 'Infantry'), ('cavalry', 'Cavalry'), ('war machine', 'War Machine'),
        ('manifestation', 'Manifestation'), ('monster', 'Monster'), ('terrain', 'Terrain'),
    ) if word in value.lower().replace('infa ntry', 'infantry')), 'Other')


def pdf_rows(filename, faction_names):
    entries = []
    with pdfplumber.open(filename) as pdf:
        version = pdf.pages[0].extract_text().splitlines()[2].title()
        for page in pdf.pages[2:]:
            title = page.extract_text().splitlines()[3]
            if title == 'REGIMENTS OF RENOWN':
                continue  # These bundles do not have individual unit points.
            faction = title
            for table in page.find_tables():
                header = None
                for row in table.extract():
                    if row[0] and all(cell is None for cell in row[1:]):
                        faction = row[0]
                        continue
                    if 'UNIT SIZE' in row and 'POINTS' in row:
                        header = row
                        continue
                    if not header or not row[0] or not any(row[1:]):
                        continue
                    assert header[0] in {'HEROES', 'UNITS', 'LEGENDS HEROES', 'LEGENDS UNITS'}, header
                    name = clean(row[0])
                    kind = 'Legends' if header[0].startswith('LEGENDS') else ''
                    if name.startswith('Scourge of Aqshy '):
                        kind = 'Scourge of Aqshy'
                    if name.startswith('Scourge of Ghyran '):
                        kind = 'Scourge of Ghyran'
                    display_faction = faction_names.get(key(faction), {
                        'KHAZALITE HOLDS': 'Khazalite Holds', 'WHITE DWARF': 'White Dwarf',
                    }.get(faction, faction.title()))
                    entries.append({
                        'faction': display_faction, 'name': name, 'points': int(row[header.index('POINTS')]),
                        'size': int(row[header.index('UNIT SIZE')]), 'kind': kind,
                        'category': category(row[-3] or '', hero='HEROES' in header[0]), 'page': page.page_number,
                    })
    assert len({(row['faction'], key(row['name']), row['kind']) for row in entries}) == len(entries)
    return version, entries


def list_by_id(folder, filename, convert):
    groups = defaultdict(list)
    for row in read_export(folder, filename):
        value = convert(row)
        if value is not None and value not in groups[row['warscroll_id']]:
            groups[row['warscroll_id']].append(value)
    return groups


def attach_warscrolls(entries, folder):
    factions = {row['id']: row['name'] for row in read_export(folder, 'Factions')}
    sources = {row['id']: row['name'] for row in read_export(folder, 'Source')}
    matches = defaultdict(list)
    white_dwarf = defaultdict(list)
    for row in read_export(folder, 'Warscrolls'):
        faction = factions.get(row['faction_id'])
        if not faction or row['virtual'] == 'true' or not row['Health']:
            continue
        source = sources.get(row['source_id'], '')
        link = row['link'].lower()
        if 'spearhead' in source.lower() or 'spearhead' in link or row['role'] == 'Regiment of Renown':
            continue
        name = row['name']
        for expansion in ('Scourge of Aqshy', 'Scourge of Ghyran'):
            if source.startswith(expansion) or expansion.lower().replace(' ', '-') in link:
                if not name.startswith(expansion):
                    name = f'{expansion} {name}'
                break
        matches[(faction, key(name))].append(row)
        if row['Cost'].isdigit() and row['UnitSize'].isdigit():
            white_dwarf[(key(name), int(row['Cost']), int(row['UnitSize']))].append(row)

    keywords = list_by_id(folder, 'Warscrolls_keywords', lambda row: (
        row['keyword'] + (f" ({row['parameter']})" if row['parameter'] else '')
    ) if row['keyword'] else None)
    abilities = list_by_id(folder, 'Warscrolls_abilities', lambda row: plain(row['name']) or None)

    def weapon(row):
        name, kind = clean(row['name']), row['type'].lower()
        if not name or kind not in ('melee', 'ranged'):
            return None
        fields = (['Rng'] if kind == 'ranged' else []) + ['Atk', 'Hit', 'Wnd', 'Rnd', 'Dmg']
        return kind, [name, *[plain(row[field]) or '—' for field in fields], plain(row['abilities'])]

    weapons = list_by_id(folder, 'Warscrolls_weapons', weapon)

    aliases = {
        ('Hedonites of Slaanesh', 'Scourge of Aqshy Infernal Enrapturess'): 'Scourge of Aqshy Infernal Enrapturess, Herald of Slaanesh',
        ('Kruleboyz', 'Kruleboyz Monsta-killaz'): 'Monsta-killaz',
        ('Soulblight Gravelords', 'Wight King on Skeletal Steed'): 'Wight King on Skeleton Steed',
    }
    for entry in entries:
        faction, name = entry['faction'], entry['name']
        if faction == 'White Dwarf':
            candidates = white_dwarf[(key(name), entry['points'], entry['size'])]
        else:
            candidates = matches[(faction, key(aliases.get((faction, name), name)))]
        if len(candidates) > 1:
            # Alternate versions sometimes share a name. Keep only unambiguous matches.
            compatible = [row for row in candidates if (
                'legends' in sources.get(row['source_id'], '').lower() or 'legends warscroll' in row['notes'].lower()
            ) == (entry['kind'] == 'Legends')]
            candidates = compatible or candidates
        if len(candidates) != 1:
            continue
        row = candidates[0]
        if not row['link'].startswith('https://wahapedia.ru/aos4/factions/'):
            continue
        unit_id = row['id']
        profile = {field.lower(): clean(row[field]) for field in ('Move', 'Health', 'Save', 'Control', 'Ward') if clean(row[field])}
        profile['url'] = row['link']
        profile['keywords'] = keywords[unit_id]
        profile['abilities'] = abilities[unit_id]
        for kind, values in weapons[unit_id]:
            profile.setdefault(kind, []).append(values)
        entry['profile'] = profile
        if entry['category'] == 'Other':
            entry['category'] = category(row['role'])


def main():
    parser = argparse.ArgumentParser(description='Generate the roster catalogue from a battle profiles PDF and a Wahapedia CSV export.')
    parser.add_argument('pdf', type=Path)
    parser.add_argument('export', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    faction_names = {key(row['name']): row['name'] for row in read_export(args.export, 'Factions')}
    version, entries = pdf_rows(args.pdf, faction_names)
    attach_warscrolls(entries, args.export)
    date = read_export(args.export, 'Last_update')[0]['last_update'].split()[0]
    counts = Counter((entry['faction'], 'profile' in entry) for entry in entries)
    for faction in dict.fromkeys(entry['faction'] for entry in entries):
        print(f'{faction}: {counts[(faction, True)]} / {counts[(faction, True)] + counts[(faction, False)]}')
    print(f'{len(entries)} entries, {sum("profile" in entry for entry in entries)} matched')

    with args.output.open('w', encoding='utf-8', newline='\n') as file:
        dump = lambda obj: json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
        file.write('// Generated by tools/build_catalogue.py. Points and sizes come from the battle profiles PDF.\n')
        file.write(f'const BattleCatalogueData = {{ edition: {dump(version)}, warscrollDate: {dump(date)}, entries: [\n')
        file.write(',\n'.join('  ' + dump(entry) for entry in entries))
        file.write('\n] };\n')


if __name__ == '__main__':
    main()
