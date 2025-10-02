import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let cache = null

export function loadThumunData() {
  if (cache) return cache
  // Load from frontend public canonical file
  const root = path.resolve(__dirname, '../../../quran-tester-app/public')
  const file = path.join(root, 'quran-thumun-data.json')
  const json = JSON.parse(fs.readFileSync(file, 'utf8'))
  const byId = new Map()
  for (const t of json.thumuns || []) byId.set(Number(t.id), t)
  cache = { meta: json.metadata, list: json.thumuns, byId }
  return cache
}

export function getThumunById(id) {
  const { byId } = loadThumunData()
  return byId.get(Number(id))
}

