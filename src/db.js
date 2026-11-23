import Dexie from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import seedFoods from './data/foods.json'
import renameFoods from './data/foods_rename.json'

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
const SPLIT = ['Push', 'Pull', 'Leg', 'Back + Chest', 'Arm + Vai + Abs']

// Thêm các buổi tập mặc định còn thiếu (so theo tên), bài tập để người dùng tự nhập.
async function addSplit(tx) {
  const have = new Set((await tx.table('workouts').toArray()).map((w) => w.name.toLowerCase()))
  await tx.table('workouts').bulkAdd(SPLIT.filter((n) => !have.has(n.toLowerCase())).map((name) => ({ name, items: [] })))
}

// v2: không đổi bảng, chỉ để chạy addSplit một lần trên máy đã cài từ trước.
db.version(2).stores({}).upgrade(addSplit)
// v3: máy đã cài từ trước có danh sách món tên tiếng Anh (bị rớt chữ f khi nhập Excel) → đổi sang tên tiếng Việt.
// Chỉ đổi đúng các món gốc; món người dùng tự thêm và nhật ký cũ giữ nguyên.
db.version(3).stores({}).upgrade((tx) =>
  tx.table('foods').toCollection().modify((f) => { if (renameFoods[f.name]) f.name = renameFoods[f.name] }))
db.on('populate', async (tx) => {
  await tx.table('foods').bulkAdd(seedFoods)
  await addSplit(tx)
})

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
