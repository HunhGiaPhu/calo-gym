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

// Đơn vị hiển thị số lượng: món lỏng (liq) vẫn tính như gram nhưng hiện ml.
export const qtyLabel = (l) => (l.unit === 'g' ? (l.liq ? 'ml' : 'g') : ' phần')

export function nutrients(food, qty) {
  const k = food.unit === 'g' ? qty / 100 : qty
  const r = (x) => Math.round((x || 0) * k * 10) / 10
  return { kcal: r(food.kcal), p: r(food.p), c: r(food.c), f: r(food.f), ...(food.s != null && { s: r(food.s) }) }
}

// AHA: nam ≤36g đường thêm vào mỗi ngày (nữ ≤25g). App 1 người dùng, nam.
export const SUGAR_LIMIT = 36

export const sumLogs = (logs) =>
  logs.reduce((s, l) => ({ kcal: s.kcal + l.kcal, p: s.p + l.p, c: s.c + l.c, f: s.f + l.f, s: s.s + (l.s || 0) }),
    { kcal: 0, p: 0, c: 0, f: 0, s: 0 })

export const ACTIVITY = [
  [1.2, 'Ít vận động'],
  [1.375, 'Tập 1–3 buổi/tuần'],
  [1.55, 'Tập 3–5 buổi/tuần'],
  [1.725, 'Tập 6–7 buổi/tuần'],
]

// Ngày tập +TRAIN_DELTA kcal; ngày nghỉ trừ bù để trung bình cả tuần vẫn bằng mục tiêu gốc.
export const TRAIN_DELTA = 150
export function dayAdjust(schedule, wd, delta = TRAIN_DELTA) {
  const n = Object.values(schedule || {}).filter(Boolean).length // số ngày tập/tuần
  if (n <= 0 || n >= 7) return 0
  return schedule[wd] ? delta : -Math.round((delta * n) / (7 - n))
}

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

// Thống kê 7 ngày tới `end` (gồm end). Chỉ tính ngày có ghi món, để ngày quên ghi không kéo trung bình xuống.
export function weekStats(logs, end, t) {
  const logged = Array.from({ length: 7 }, (_, i) => logs.filter((l) => l.date === addDays(end, i - 6)))
    .filter((day) => day.length).map(sumLogs)
  if (!logged.length) return null
  const avg = (k) => Math.round(logged.reduce((s, x) => s + x[k], 0) / logged.length)
  return {
    days: logged.length, kcal: avg('kcal'), p: avg('p'),
    proteinDays: t ? logged.filter((x) => x.p >= t.p * 0.9).length : null, // đạt ≥90% mục tiêu protein
    overDays: t ? logged.filter((x) => x.kcal > t.kcal * 1.05).length : null, // vượt >5% mục tiêu kcal
  }
}

// 1RM ước tính (công thức Epley) của set tốt nhất trong một buổi.
export const bestE1rm = (sets) =>
  Math.max(0, ...sets.filter((s) => s.kg > 0 && s.reps > 0).map((s) => Math.round(s.kg * (1 + s.reps / 30) * 10) / 10))

// Các buổi của một bài, theo ngày: 1RM ước tính + mức tạ nặng nhất.
export const liftSeries = (sessions, name) => sessions
  .filter((s) => s.exercise === name).sort((a, b) => (a.date < b.date ? -1 : 1))
  .map((s) => ({ date: s.date, e1rm: bestE1rm(s.sets), top: Math.max(0, ...s.sets.map((x) => x.kg || 0)) }))
  .filter((x) => x.e1rm > 0)

// Gợi ý món giàu protein (tính theo gram) để bù phần còn thiếu: ưu tiên nhiều protein trên mỗi kcal.
export function proteinPicks(foods, need, n = 3) {
  if (!(need > 0)) return []
  return foods.filter((f) => f.unit === 'g' && f.p >= 10 && f.kcal > 0)
    .sort((a, b) => b.p / b.kcal - a.p / a.kcal)
    .slice(0, n)
    .map((f) => {
      // Mỗi gợi ý chỉ bù tối đa 40g protein (cỡ một bữa phụ), không dồn cả phần thiếu vào một món.
      const grams = Math.min(300, Math.max(10, Math.round((Math.min(need, 40) / f.p) * 10) * 10)) // làm tròn 10g, tối đa 300g
      return { ...f, grams, pAdd: Math.round((f.p * grams) / 100), kcalAdd: Math.round((f.kcal * grams) / 100) }
    })
}
