#!/usr/bin/env python3
import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path


def load_json(path: Path):
    with path.open('r', encoding='utf-8') as f:
        return json.load(f)


def write_json(path: Path, data):
    with path.open('w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def make_backup(src: Path) -> Path:
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    backup = src.parent / f"{src.name}.backup.{timestamp}"
    backup.write_text(src.read_text(encoding='utf-8'), encoding='utf-8')
    return backup


def update_quarters(thumuns: list) -> int:
    changes = 0
    for t in thumuns:
        tid = t.get('id')
        if not isinstance(tid, int):
            continue
        new_q = (tid + 1) // 2  # ceil(id/2)
        if t.get('quarter') != new_q:
            t['quarter'] = new_q
            changes += 1
    return changes


def index_by_id(items: list) -> dict:
    return {item.get('id'): item for item in items if isinstance(item.get('id'), int)}


def compare_records(app_item: dict, excel_item: dict) -> dict:
    diffs = {}
    # Compare exact fields: id, name, hizb, juz, naqza
    for key in ('id', 'name', 'hizb', 'juz', 'naqza'):
        if app_item.get(key) != excel_item.get(key):
            diffs[key] = {
                'app': app_item.get(key),
                'excel': excel_item.get(key),
            }
    return diffs


def validate_against_excel(app_data: dict, excel_list: list) -> dict:
    app_thumuns = app_data.get('thumuns') or []
    app_index = index_by_id(app_thumuns)
    excel_index = index_by_id(excel_list)

    report = {
        'missing_in_app': [],
        'missing_in_excel': [],
        'mismatches': [],
        'counts': {
            'app_thumuns': len(app_thumuns),
            'excel_thumuns': len(excel_list),
        },
    }

    # IDs union
    all_ids = set(app_index.keys()) | set(excel_index.keys())
    for tid in sorted(all_ids):
        a = app_index.get(tid)
        e = excel_index.get(tid)
        if a is None and e is not None:
            report['missing_in_app'].append(tid)
            continue
        if e is None and a is not None:
            report['missing_in_excel'].append(tid)
            continue
        # Both present, compare
        diffs = compare_records(a, e)
        if diffs:
            report['mismatches'].append({'id': tid, 'diffs': diffs})

    return report


def print_report(report: dict):
    print("Validation Report")
    print("=================")
    counts = report.get('counts', {})
    print(f"App thumuns:   {counts.get('app_thumuns')}")
    print(f"Excel thumuns: {counts.get('excel_thumuns')}")
    print("")
    print(f"Missing in app:   {len(report.get('missing_in_app', []))}")
    if report.get('missing_in_app'):
        print("  IDs:", ', '.join(map(str, report['missing_in_app'][:20])), ("..." if len(report['missing_in_app']) > 20 else ""))
    print(f"Missing in excel: {len(report.get('missing_in_excel', []))}")
    if report.get('missing_in_excel'):
        print("  IDs:", ', '.join(map(str, report['missing_in_excel'][:20])), ("..." if len(report['missing_in_excel']) > 20 else ""))
    print(f"Mismatches:       {len(report.get('mismatches', []))}")
    # Show first few mismatches succinctly
    for item in report.get('mismatches', [])[:10]:
        tid = item['id']
        diffs = item['diffs']
        parts = [f"{k}: app={v['app']!r} vs excel={v['excel']!r}" for k, v in diffs.items()]
        print(f"  id {tid}: ", '; '.join(parts))


def ensure_reports_dir(base: Path) -> Path:
    reports_dir = base / 'scripts' / 'reports'
    reports_dir.mkdir(parents=True, exist_ok=True)
    return reports_dir


def main():
    parser = argparse.ArgumentParser(description='Update quarter numbers and validate against Excel-derived JSON.')
    parser.add_argument('--app-json', default='quran-tester-app/public/quran-thumun-data.json', help='Path to app JSON file')
    parser.add_argument('--excel-json', default='thumuns.from_excel.json', help='Path to Excel-derived JSON file')
    parser.add_argument('--no-backup', action='store_true', help='Do not create backup before writing')
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    app_path = (root / args.app_json).resolve()
    excel_path = (root / args.excel_json).resolve()

    if not app_path.exists():
        print(f"ERROR: App JSON not found: {app_path}", file=sys.stderr)
        sys.exit(1)
    if not excel_path.exists():
        print(f"ERROR: Excel JSON not found: {excel_path}", file=sys.stderr)
        sys.exit(1)

    app_data = load_json(app_path)
    excel_data = load_json(excel_path)

    # Update quarters
    thumuns = app_data.get('thumuns') or []
    changed = update_quarters(thumuns)

    # Backup and write
    if not args.no_backup:
        backup_path = make_backup(app_path)
        print(f"Backup created: {backup_path}")
    write_json(app_path, app_data)
    print(f"Updated quarters written: {app_path} (changed {changed} records)")

    # Validate
    report = validate_against_excel(app_data, excel_data)
    print_report(report)

    # Save report files
    reports_dir = ensure_reports_dir(root)
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    json_report_path = reports_dir / f"validation_report_{timestamp}.json"
    write_json(json_report_path, report)
    print(f"Report JSON: {json_report_path}")

    # Also write CSV mismatches for easier viewing
    try:
        import csv
        csv_path = reports_dir / f"validation_mismatches_{timestamp}.csv"
        with csv_path.open('w', encoding='utf-8', newline='') as cf:
            writer = csv.writer(cf)
            writer.writerow(['id', 'field', 'app_value', 'excel_value'])
            for m in report.get('mismatches', []):
                tid = m['id']
                for field, val in m['diffs'].items():
                    writer.writerow([tid, field, val.get('app'), val.get('excel')])
        print(f"Report CSV:  {csv_path}")
    except Exception as e:
        print(f"WARN: Failed to write CSV report: {e}")


if __name__ == '__main__':
    main()


