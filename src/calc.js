// Hàm thuần (không đụng DB) để dễ test.

export const toDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const today = () => toDate()

export function nutrients(food, qty) {
  const k = food.unit === 'g' ? qty / 100 : qty
  const r = (x) => Math.round((x || 0) * k * 10) / 10
  return { kcal: r(food.kcal), p: r(food.p), c: r(food.c), f: r(food.f) }
}

export const sumLogs = (logs) =>
  logs.reduce((s, l) => ({ kcal: s.kcal + l.kcal, p: s.p + l.p, c: s.c + l.c, f: s.f + l.f }),
    { kcal: 0, p: 0, c: 0, f: 0 })

export const ACTIVITY = [
  [1.2, 'Ít vận động'],
  [1.375, 'Tập 1–3 buổi/tuần'],
  [1.55, 'Tập 3–5 buổi/tuần'],
  [1.725, 'Tập 6–7 buổi/tuần'],
]

// Mifflin-St Jeor. Protein 2g/kg, fat 0.8g/kg, phần còn lại là carb.
export function targets({ sex, age, height, weight, activity, deficit }) {
  const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === 'nam' ? 5 : -161)
  const tdee = Math.round(bmr * activity)
  const kcal = tdee - deficit
  const p = Math.round(2 * weight)
  const f = Math.round(0.8 * weight)
  const c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4))
  return { tdee, kcal, p, c, f }
}

// "Lat pulldown 3x10" -> { name, sets: 3, reps: 10 }
export function parsePlan(text) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const m = line.match(/^(.*?)\s+(\d+)\s*[x×]\s*(\d+)$/i)
    return m ? { name: m[1].trim(), sets: +m[2], reps: +m[3] } : { name: line, sets: 3, reps: 10 }
  })
}

export const planToText = (items) => items.map((e) => `${e.name} ${e.sets}x${e.reps}`).join('\n')

// Streak = số ngày có lịch tập liên tiếp đã tập. Ngày nghỉ (không có lịch) bỏ qua.
// Hôm nay chưa tập thì chưa tính là đứt chuỗi.
export function streak(doneDates, schedule, now = new Date()) {
  const d = new Date(now)
  let n = 0
  if (!doneDates.has(toDate(d))) d.setDate(d.getDate() - 1)
  for (let i = 0; i < 400; i++, d.setDate(d.getDate() - 1)) {
    const done = doneDates.has(toDate(d))
    if (schedule[d.getDay()]) {
      if (!done) break
      n++
    } else if (done) n++
  }
  return n
}
