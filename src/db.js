import Dexie from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import seedFoods from './data/foods.json'

export const db = new Dexie('calo-gym')
db.version(1).stores({
  foods: '++id, name',
  combos: '++id, name',
  logs: '++id, date',
  workouts: '++id, name',
  sessions: '++id, date, exercise',
  weights: 'date',
  settings: 'key',
})
db.on('populate', (tx) => tx.table('foods').bulkAdd(seedFoods))

// Xin trình duyệt đừng tự xoá dữ liệu khi máy đầy bộ nhớ.
navigator.storage?.persist?.()

export const TABLES = ['foods', 'combos', 'logs', 'workouts', 'sessions', 'weights', 'settings']

export const setSetting = (key, value) => db.settings.put({ key, value })

export function useSetting(key, fallback) {
  const row = useLiveQuery(() => db.settings.get(key), [key])
  return row ? row.value : fallback
}

export async function exportAll() {
  const out = { app: 'calo-gym', version: 1 }
  for (const t of TABLES) out[t] = await db.table(t).toArray()
  return out
}

export async function importAll(data) {
  // File backup là dữ liệu từ ngoài: kiểm tra trước khi xoá dữ liệu hiện tại.
  if (data?.app !== 'calo-gym' || !TABLES.every((t) => Array.isArray(data[t]))) {
    throw new Error('File không phải backup của app này')
  }
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear()
      await db.table(t).bulkAdd(data[t])
    }
  })
}
