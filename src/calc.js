// Hàm thuần (không đụng DB) để dễ test.

export const toDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const today = () => toDate()

const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return toDate(d) }

const mean = (a) => a.reduce((s, w) => s + w.kg, 0) / a.length

// Cân trung bình 7 ngày (gồm ngày đó) cho từng lần cân. weights đã sắp theo ngày.
export const rolling7 = (weights) => weights.map((w) => {
  const from = addDays(w.date, -6)
  return { ...w, avg: Math.round(mean(weights.filter((x) => x.date >= from && x.date <= w.date)) * 10) / 10 }
})

// So TB 7 ngày gần nhất với 7 ngày trước đó. Giảm mỡ giữ cơ: khoảng 0.25–1% cân nặng mỗi tuần.
// adjust = số kcal nên cộng vào mức thâm hụt.
export function weightAdvice(weights, now = today()) {
  const win = (a, b) => weights.filter((w) => w.date > addDays(now, -a) && w.date <= addDays(now, -b))
  const cur = win(7, 0)
  const prev = win(14, 7)
  if (cur.length < 3 || prev.length < 3) return null
  const change = mean(cur) - mean(prev)
  const pct = (change / mean(prev)) * 100
  const r = { change: Math.round(change * 100) / 100, pct: Math.round(pct * 100) / 100 }
  if (pct > -0.25) return { ...r, adjust: 150, msg: 'Gần như không giảm' }
  if (pct < -1) return { ...r, adjust: -150, msg: 'Giảm hơi nhanh, dễ mất cơ' }
  return { ...r, adjust: 0, msg: 'Đúng hướng' }
}

// Lần trước làm đủ số set và đủ rep mọi set -> gợi ý +2.5kg.
export function nextKg(plan, last) {
  if (!last?.sets?.length || last.sets.length < plan.sets) return null
  if (!last.sets.every((s) => s.reps >= plan.reps)) return null
  const top = Math.max(...last.sets.map((s) => s.kg))
  return top > 0 ? top + 2.5 : null
}

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
