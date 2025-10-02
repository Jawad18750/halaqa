#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import re
import unicodedata
from pathlib import Path


def normalize_arabic(text: str) -> str:
    if text is None:
        return ""
    text = unicodedata.normalize("NFC", text)
    # Remove diacritics and tatweel
    text = re.sub(r"[\u064B-\u0652\u0670\u0640]", "", text)
    return text.strip()


def build_surah_map() -> dict:
    surahs = [
        "",
        "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف",
        "الأنفال", "التوبة", "يونس", "هود", "يوسف", "الرعد", "إبراهيم", "الحجر",
        "النحل", "الإسراء", "الكهف", "مريم", "طه", "الأنبياء", "الحج", "المؤمنون",
        "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم",
        "لقمان", "السجدة", "الأحزاب", "سبإ", "فاطر", "يس", "الصافات", "ص",
        "الزمر", "غافر", "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية",
        "الأحقاف", "محمد", "الفتح", "الحجرات", "ق", "الذاريات", "الطور", "النجم",
        "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة",
        "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك",
        "القلم", "الحاقة", "المعارج", "نوح", "الجن", "المزمل", "المدثر", "القيامة",
        "الإنسان", "المرسلات", "النبإ", "النازعات", "عبس", "التكوير", "الإنفطار",
        "المطففين", "الإنشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر",
        "البلد", "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر",
        "البينة", "الزلزلة", "العاديات", "القارعة", "التكاثر", "العصر", "الهمزة",
        "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر", "المسد",
        "الإخلاص", "الفلق", "الناس",
    ]
    return {normalize_arabic(n): i for i, n in enumerate(surahs) if n}


def parse_pdf_index_text(txt: str) -> dict:
    # Pattern examples expected in extracted text:
    # "صفحة 58 | الثمن 2 في سورة آل عمران"
    # Allow optional separators |, -, different dashes
    pattern = re.compile(
        r"صفحة\s*(\d+)\s*[\|\-–—]?\s*الثمن\s*([0-9٠-٩]+)\s*في\s*سورة\s*([\u0600-\u06FF\s]+)"
    )
    arabic_digits = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")

    by_id = {}
    for m in pattern.finditer(txt):
        page = int(m.group(1))
        tid = int(m.group(2).translate(arabic_digits))
        surah_name = m.group(3).strip().splitlines()[0].strip()
        surah_name = normalize_arabic(surah_name)
        by_id[tid] = {"page": page, "surah": surah_name}
    return by_id


def main() -> None:
    base = Path(__file__).resolve().parents[1]
    pdf_txt = base / "pdf_extracted.txt"
    json_path = base / "quran-thumun-data.json"

    if not pdf_txt.exists():
        raise SystemExit("pdf_extracted.txt not found. Please extract PDF text first.")
    text = pdf_txt.read_text(encoding="utf-8")

    pdf_map = parse_pdf_index_text(text)
    name_to_num = build_surah_map()

    data = json.loads(json_path.read_text(encoding="utf-8"))

    filled_pages = 0
    filled_surahnums = 0
    updated_names = 0

    for t in data.get("thumuns", []):
        tid = t.get("id")
        e = pdf_map.get(tid)
        # Fill page from PDF if missing
        if e and (t.get("page") is None or t.get("page") == ""):
            t["page"] = e["page"]
            filled_pages += 1
        # Align surah name from PDF if current is empty
        if e and (not t.get("surah")):
            t["surah"] = e["surah"]
            updated_names += 1
        # Derive surahNumber from current surah name if missing
        if t.get("surah") and not t.get("surahNumber"):
            num = name_to_num.get(normalize_arabic(t["surah"]))
            if num:
                t["surahNumber"] = num
                filled_surahnums += 1

    json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"Updated JSON. Pages filled: {filled_pages}, SurahNumbers filled: {filled_surahnums}, Names set: {updated_names}"
    )


if __name__ == "__main__":
    main()


