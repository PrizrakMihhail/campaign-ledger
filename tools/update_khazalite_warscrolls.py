import argparse
import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import quote

from lxml import html


SOURCE = 'https://wahapedia.ru/aos4/factions/khazalite-holds/warscrolls.html'
FACTION = 'Khazalite Holds'
ALIASES = {'Valayan Guardians with Rune Axes and Shields': 'Valayan Guardians with Rune Axe and Shields'}


def has_class(name):
    return f"contains(concat(' ',normalize-space(@class),' '),' {name} ')"


def classes(element, name):
    return element.xpath(f'.//*[{has_class(name)}]')


def clean(value):
    return ' '.join((value or '').split())


def text(element):
    return clean(element.text_content())


def weapons(sheet):
    groups = {}
    for table in classes(sheet, 'wTable'):
        kind = None
        for row in table.xpath('.//tr'):
            if row.xpath(f'./td[{has_class("wsHeaderCellName_RangedWeapons")}]'):
                kind = 'ranged'
            elif row.xpath(f'./td[{has_class("wsHeaderCellName_MeleeWeapons")}]'):
                kind = 'melee'
            elif kind and row.xpath(f'./td[{has_class("wsCell")}]'):
                label = row.xpath(f'./td[{has_class("wsDataCell_long")}]')[-1]
                name = clean(''.join(label.xpath('./text()')))
                cells = [text(cell) for cell in row.xpath(f'./td[{has_class("wsCell")}]')]
                values = cells[-6:] if kind == 'ranged' else cells[-5:]
                if not name or len(values) != (6 if kind == 'ranged' else 5) or not all(values):
                    raise ValueError(f'Incomplete {kind} weapon row: {name!r} {cells!r}')
                traits = [text(el) for el in classes(label, 'wsWeaponAbility')]
                if classes(label, 'wsDamage'):
                    traits.append('See battle damage rules')
                groups.setdefault(kind, []).append([name, *values, ' · '.join(traits)])
    return groups


def profile(sheet, retrieved):
    stats = {}
    for field, class_name in {'move': 'wsMove', 'health': 'wsWounds', 'save': 'wsSave', 'control': 'wsBravery', 'ward': 'wsWard'}.items():
        nodes = classes(sheet, class_name)
        if nodes and text(nodes[0]):
            stats[field] = text(nodes[0])
    if not {'move', 'health', 'save', 'control'} <= stats.keys():
        raise ValueError(f'Incomplete characteristics: {stats!r}')
    anchor, = sheet.xpath('./a[@id]/@id')
    keyword_lines = classes(sheet, 'wsKeywordLine1') + classes(sheet, 'wsKeywordLine2')
    keywords = [clean(value) for node in keyword_lines for value in text(node).split(',') if clean(value)]
    abilities = [clean(node.text) for body in classes(sheet, 'abBody') for node in body.xpath('./b[1]') if clean(node.text)]
    return {
        **stats, 'url': SOURCE + '#' + quote(anchor, safe='-'), 'retrieved': retrieved,
        'keywords': list(dict.fromkeys(keywords)), 'abilities': list(dict.fromkeys(abilities)), **weapons(sheet),
    }


def update(catalogue, warscroll_page, retrieved):
    prefix, data = catalogue.read_text(encoding='utf-8').split('entries: ', 1)
    entries = json.loads(data.rsplit('}', 1)[0])
    root = html.fromstring(warscroll_page.read_text(encoding='utf-8-sig'))
    by_name = {}
    for sheet in classes(root, 'datasheet'):
        headings = classes(sheet, 'wsHeaderIn')
        if headings:
            by_name.setdefault(clean(headings[0].text).casefold(), []).append(sheet)

    linked = 0
    for entry in entries:
        if entry['faction'] != FACTION:
            continue
        name = entry['name']
        matches = by_name.get(ALIASES.get(name, name).casefold(), [])
        if len(matches) != 1:
            raise ValueError(f'Expected one Khazalite Holds warscroll for {name}, found {len(matches)}')
        sheet = matches[0]
        details, *_ = classes(sheet, 'PitchedBattleProfile')
        numbers = re.search(r'Unit Size:\s*(\d+)\s*Points:\s*(\d+)', text(details))
        if not numbers or int(numbers[1]) != entry['size']:
            raise ValueError(f'Could not verify the matching unit size for {name}')
        if int(numbers[2]) != entry['points']:
            print(f'{name}: keeping the PDF’s {entry["points"]} points; the web page lists {numbers[2]}.')
        if name in ALIASES:
            entry['aliases'] = [ALIASES[name]]
        entry['profile'] = profile(sheet, retrieved)
        linked += 1
    if not linked:
        raise ValueError('No Khazalite Holds entries were found in the catalogue')
    rows = ',\n'.join('  ' + json.dumps(entry, ensure_ascii=False, separators=(',', ':')) for entry in entries)
    catalogue.write_text(prefix + 'entries: [\n' + rows + '\n] };\n', encoding='utf-8', newline='\n')
    print(f'Linked {linked} Khazalite Holds warscrolls.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Refresh Khazalite Holds profiles from a downloaded Wahapedia faction warscroll page.')
    parser.add_argument('catalogue', type=Path)
    parser.add_argument('warscroll_page', type=Path)
    parser.add_argument('--retrieved', required=True, type=date.fromisoformat)
    args = parser.parse_args()
    update(args.catalogue, args.warscroll_page, args.retrieved.isoformat())
