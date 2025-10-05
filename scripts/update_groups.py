#!/usr/bin/env python3
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_JSON = ROOT / 'quran-tester-app' / 'public' / 'quran-thumun-data.json'
EXCEL_JSON = ROOT / 'thumuns.from_excel.json'
REPORTS_DIR = ROOT / 'scripts' / 'reports'

def load_json(p: Path):
    with p.open('r', encoding='utf-8') as f:
        return json.load(f)

def save_json(p: Path, data):
    with p.open('w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def compute_groups(th):
    # th is a dict with keys: id, hizb, name, ...
    tid = int(th['id'])
    hizb = int(th.get('hizb') or 0)
    # fiveHizbGroup: 1..12
    five_hizb_group = (hizb - 1) // 5 + 1 if hizb > 0 else None
    # Quran quarters: 480 thumuns total → 120 per quarter
    quran_quarter = (tid - 1) // 120 + 1
    # Quran halves: 240 thumuns per half
    quran_half = (tid - 1) // 240 + 1
    th['fiveHizbGroup'] = five_hizb_group
    th['quranQuarter'] = quran_quarter
    th['quranHalf'] = quran_half

def label_five_hizb(thumuns):
    # Use first thumun name inside each 5-hizb group as label
    labels = {}
    for k in range(1, 13):
        group = [t for t in thumuns if t.get('fiveHizbGroup') == k]
        group.sort(key=lambda x: int(x['id']))
        labels[k] = group[0]['name'] if group else ''
    for t in thumuns:
        k = t.get('fiveHizbGroup')
        if k:
            t['fiveHizbLabel'] = labels.get(k, '')

def validate_against_excel(app_data, excel_data):
    # Compare id, name, hizb, juz, naqza exactly (name exact string)
    excel_by_id = {int(t['id']): t for t in excel_data.get('thumuns', excel_data)}
    mismatches = []
    for t in app_data['thumuns']:
        tid = int(t['id'])
        et = excel_by_id.get(tid)
        if not et:
            mismatches.append({'id': tid, 'issue': 'missing_in_excel'})
            continue
        for key in ['name', 'hizb', 'juz', 'naqza']:
            if (et.get(key) != t.get(key)):
                mismatches.append({'id': tid, 'field': key, 'excel': et.get(key), 'app': t.get(key)})
    return mismatches

def main():
    ts = datetime.now().strftime('%Y%m%d%H%M%S')
    if not PUBLIC_JSON.exists():
        print(f"ERROR: {PUBLIC_JSON} not found", file=sys.stderr)
        sys.exit(1)

    data = load_json(PUBLIC_JSON)
    if 'thumuns' not in data:
        print('ERROR: invalid data file (no thumuns key)', file=sys.stderr)
        sys.exit(1)

    # Backup first
    backup = PUBLIC_JSON.with_suffix(f'.json.backup.{ts}')
    shutil.copy2(PUBLIC_JSON, backup)

    # Compute groups
    for t in data['thumuns']:
        compute_groups(t)
    label_five_hizb(data['thumuns'])

    # Save
    save_json(PUBLIC_JSON, data)

    # Validation
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    mismatches = []
    if EXCEL_JSON.exists():
        try:
            excel = load_json(EXCEL_JSON)
            mismatches = validate_against_excel(data, excel)
        except Exception as e:
            print(f'WARN: failed to validate against Excel JSON: {e}', file=sys.stderr)

    report_json = REPORTS_DIR / f'groups_update_report_{ts}.json'
    save_json(report_json, {
        'timestamp': ts,
        'file': str(PUBLIC_JSON),
        'backup': str(backup),
        'mismatches_count': len(mismatches),
        'mismatches_sample': mismatches[:50]
    })

    # CSV for quick scan
    if mismatches:
        csv_path = REPORTS_DIR / f'groups_update_mismatches_{ts}.csv'
        import csv
        with csv_path.open('w', newline='', encoding='utf-8') as f:
            w = csv.writer(f)
            w.writerow(['id','field','excel','app','issue'])
            for m in mismatches:
                w.writerow([m.get('id'), m.get('field',''), m.get('excel',''), m.get('app',''), m.get('issue','')])

    print(f'Updated {PUBLIC_JSON.name}. Backup: {backup.name}. Mismatches: {len(mismatches)}. Report: {report_json.name}')

if __name__ == '__main__':
    main()


