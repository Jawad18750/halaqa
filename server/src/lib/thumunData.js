import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let cache = null

export function loadThumunData() {
  if (cache) return cache

  // Resolution order:
  // 1) Explicit THUMUN_DATA_PATH from env
  // 2) Bundled copy under server/data/quran-thumun-data.json
  // 3) Frontend public path (for local dev): quran-tester-app/public/quran-thumun-data.json
  const candidates = []
  if (process.env.THUMUN_DATA_PATH) candidates.push(process.env.THUMUN_DATA_PATH)
  candidates.push(path.resolve(__dirname, '../data/quran-thumun-data.json'))
  candidates.push(path.resolve(__dirname, '../../../quran-tester-app/public/quran-thumun-data.json'))

  let loaded = null
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const json = JSON.parse(fs.readFileSync(p, 'utf8'))
        const byId = new Map()
        for (const t of json.thumuns || []) byId.set(Number(t.id), t)
        cache = { meta: json.metadata, list: json.thumuns, byId, path: p }
        loaded = cache
        break
      }
    } catch (e) {
      console.error('[thumunData] failed to read', p, e?.message)
    }
  }

  if (!loaded) {
    throw new Error('quran-thumun-data.json not found. Set THUMUN_DATA_PATH or include server/data/quran-thumun-data.json')
  }
  console.log('[thumunData] loaded from', loaded.path)
  return loaded
}

export function getThumunById(id) {
  const { byId } = loadThumunData()
  return byId.get(Number(id))
}

