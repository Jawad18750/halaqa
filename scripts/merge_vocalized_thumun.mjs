#!/usr/bin/env node
/**
 * Merge vocalized Arabic names into canonical quran-thumun-data.json.
 * Keeps grouping fields (hizb, quarter, naqza, fiveHizbGroup, etc.) from the app JSON;
 * updates text fields (name, surah, fiveHizbLabel) from the vocalized source by id.
 *
 * Usage:
 *   node scripts/merge_vocalized_thumun.mjs [path/to/quran-thumun-data-vocalized.json]
 *
 * Default vocalized path: data-import/quran-thumun-data-vocalized.json
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const BASE_PATH = path.join(ROOT, 'quran-tester-app/public/quran-thumun-data.json')
const SERVER_PATH = path.join(ROOT, 'server/src/data/quran-thumun-data.json')
const DEFAULT_VOCAL = path.join(ROOT, 'data-import/quran-thumun-data-vocalized.json')

const TEXT_KEYS = ['name', 'surah', 'fiveHizbLabel']
const STRUCT_KEYS = ['page', 'hizb', 'quarter', 'juz', 'naqza', 'surahNumber', 'fiveHizbGroup', 'quranQuarter', 'quranHalf']

function stamp() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function backup(file) {
  if (!fs.existsSync(file)) return null
  const dest = `${file}.backup.${stamp()}`
  fs.copyFileSync(file, dest)
  return dest
}

function hasHarakat(s) {
  return /[\u064B-\u065F\u0670\u06D6-\u06ED]/.test(String(s || ''))
}

function main() {
  const vocalPath = path.resolve(process.argv[2] || DEFAULT_VOCAL)
  if (!fs.existsSync(vocalPath)) {
    console.error(`Vocalized file not found: ${vocalPath}`)
    console.error('Copy your file to data-import/quran-thumun-data-vocalized.json or pass the path as the first argument.')
    process.exit(1)
  }
  if (!fs.existsSync(BASE_PATH)) {
    console.error(`Base file not found: ${BASE_PATH}`)
    process.exit(1)
  }

  const base = loadJson(BASE_PATH)
  const vocal = loadJson(vocalPath)
  const baseList = base.thumuns || []
  const vocalList = vocal.thumuns || []

  if (vocalList.length !== 480) {
    console.warn(`Warning: vocalized thumun count is ${vocalList.length}, expected 480`)
  }
  if (baseList.length !== 480) {
    console.warn(`Warning: base thumun count is ${baseList.length}, expected 480`)
  }

  const vocalById = new Map(vocalList.map(t => [Number(t.id), t]))
  const missing = []
  const mismatches = []
  let namesUpdated = 0
  let surahUpdated = 0
  let labelUpdated = 0
  let harakatCount = 0

  for (const t of baseList) {
    const id = Number(t.id)
    const v = vocalById.get(id)
    if (!v) {
      missing.push(id)
      continue
    }
    for (const key of STRUCT_KEYS) {
      if (v[key] == null || t[key] == null) continue
      if (Number(v[key]) !== Number(t[key])) {
        mismatches.push({ id, key, base: t[key], vocal: v[key] })
      }
    }
    if (v.name && v.name !== t.name) {
      t.name = v.name
      namesUpdated++
      if (hasHarakat(v.name)) harakatCount++
    }
    if (v.surah && v.surah !== t.surah) {
      t.surah = v.surah
      surahUpdated++
    }
    if (v.fiveHizbLabel && v.fiveHizbLabel !== t.fiveHizbLabel) {
      t.fiveHizbLabel = v.fiveHizbLabel
      labelUpdated++
    }
    // If vocalized entry has grouping fields missing on base, fill them
    for (const key of ['fiveHizbGroup', 'quranQuarter', 'quranHalf']) {
      if (t[key] == null && v[key] != null) t[key] = v[key]
    }
  }

  if (missing.length) {
    console.error(`Missing ids in vocalized file: ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? '…' : ''}`)
    process.exit(1)
  }

  base.metadata = {
    ...base.metadata,
    ...Object.fromEntries(
      Object.entries(vocal.metadata || {}).filter(([k]) => !['totalThumuns', 'totalHizbs', 'totalNaqzas', 'totalJuz'].includes(k))
    ),
    totalThumuns: base.metadata?.totalThumuns ?? 480,
    totalHizbs: base.metadata?.totalHizbs ?? 60,
    totalNaqzas: base.metadata?.totalNaqzas ?? 20,
    totalJuz: base.metadata?.totalJuz ?? 30,
    lastUpdated: new Date().toISOString().slice(0, 10),
    namesVocalized: true,
    description: 'Complete index of 480 Thumuns with vocalized opening-verse names (تشكيل)',
  }

  const out = `${JSON.stringify(base, null, 2)}\n`
  const b1 = backup(BASE_PATH)
  const b2 = backup(SERVER_PATH)
  fs.writeFileSync(BASE_PATH, out, 'utf8')
  fs.mkdirSync(path.dirname(SERVER_PATH), { recursive: true })
  fs.writeFileSync(SERVER_PATH, out, 'utf8')

  console.log('Merge complete')
  console.log(`  Vocalized source: ${vocalPath}`)
  console.log(`  Names updated: ${namesUpdated} (${harakatCount} with harakat)`)
  console.log(`  Surah updated: ${surahUpdated}`)
  console.log(`  fiveHizbLabel updated: ${labelUpdated}`)
  if (mismatches.length) {
    console.log(`  Structural mismatches (kept base values): ${mismatches.length}`)
    for (const m of mismatches.slice(0, 5)) {
      console.log(`    id ${m.id} ${m.key}: base=${m.base} vocal=${m.vocal}`)
    }
  }
  if (b1) console.log(`  Backup: ${b1}`)
  if (b2) console.log(`  Backup: ${b2}`)
  console.log(`  Wrote: ${BASE_PATH}`)
  console.log(`  Wrote: ${SERVER_PATH}`)
}

main()
