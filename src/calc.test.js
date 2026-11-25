import { expect, test } from 'vitest'
import { nutrients, sumLogs, targets, parsePlan, streak, addDays, rolling7, weightAdvice, nextKg, qtyLabel, dayAdjust } from './calc'

test('addDays qua tháng', () => {
  expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
})

test('rolling7 chỉ lấy 7 ngày gần', () => {
  const r = rolling7([{ date: '2026-11-01', kg: 80 }, { date: '2026-11-05', kg: 70 }, { date: '2026-11-09', kg: 72 }])
  expect(r.map((x) => x.avg)).toEqual([80, 75, 71])
})

const series = (start, kgs) => kgs.map((kg, i) => ({ date: addDays(start, i), kg }))
test('weightAdvice', () => {
  const now = '2026-11-19'
  expect(weightAdvice(series('2026-11-17', [70, 70, 70]), now)).toBeNull() // thiếu dữ liệu tuần trước
  const flat = series('2026-11-06', Array(14).fill(70))
  expect(weightAdvice(flat, now).adjust).toBe(150)
  const good = series('2026-11-06', [...Array(7).fill(70), ...Array(7).fill(69.6)]) // -0.57%/tuần
  expect(weightAdvice(good, now).adjust).toBe(0)
  const fast = series('2026-11-06', [...Array(7).fill(70), ...Array(7).fill(69)]) // -1.4%/tuần
  expect(weightAdvice(fast, now).adjust).toBe(-150)
})

test('nextKg', () => {
  const plan = { sets: 3, reps: 10 }
  expect(nextKg(plan, { sets: [{ kg: 40, reps: 10 }, { kg: 40, reps: 10 }, { kg: 40, reps: 11 }] })).toBe(42.5)
  expect(nextKg(plan, { sets: [{ kg: 40, reps: 10 }, { kg: 40, reps: 8 }, { kg: 40, reps: 10 }] })).toBeNull()
  expect(nextKg(plan, { sets: [{ kg: 40, reps: 10 }, { kg: 40, reps: 10 }] })).toBeNull() // thiếu set
  expect(nextKg(plan, undefined)).toBeNull()
})

test('nutrients theo gram và theo phần', () => {
  expect(nutrients({ unit: 'g', kcal: 165, p: 31, c: 0, f: 3.6 }, 400)).toEqual({ kcal: 660, p: 124, c: 0, f: 14.4 })
  expect(nutrients({ unit: 'phần', kcal: 35, p: 1, c: 7, f: 0 }, 3).kcal).toBe(105)
})

test('nutrients và sumLogs có đường, log cũ thiếu s coi là 0', () => {
  expect(nutrients({ unit: 'g', kcal: 0, p: 0, c: 0, f: 0, s: 10 }, 250).s).toBe(25)
  expect('s' in nutrients({ unit: 'g', kcal: 1, p: 0, c: 0, f: 0 }, 100)).toBe(false)
  const base = { kcal: 1, p: 1, c: 1, f: 1 }
  expect(sumLogs([{ ...base, s: 4 }, base]).s).toBe(4)
})

test('targets: nam 70kg 175cm 21t', () => {
  const t = targets({ sex: 'nam', age: 21, height: 175, weight: 70, activity: 1.55, deficit: 400 })
  expect(t.tdee).toBe(2625) // bmr 1693.75 * 1.55
  expect(t.kcal).toBe(2225)
  expect(t.p).toBe(140)
})

test('dayAdjust giữ trung bình mục tiêu kcal cả tuần', () => {
  const schedule = { 1: 1, 2: 2, 4: 3, 5: 4 }
  expect(dayAdjust(schedule, 1)).toBe(150)
  expect(dayAdjust(schedule, 0)).toBe(-Math.round((150 * 4) / 3))
  expect(4 * dayAdjust(schedule, 1) + 3 * dayAdjust(schedule, 0)).toBe(0)
  expect(dayAdjust({}, 0)).toBe(0)
  expect(dayAdjust({ 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 }, 0)).toBe(0)
  expect(dayAdjust({ 1: null, 2: 5 }, 1)).toBe(-Math.round(150 / 6))
})

test('parsePlan', () => {
  expect(parsePlan('Lat pulldown 3x10\n\nDeadlift')).toEqual([
    { name: 'Lat pulldown', sets: 3, reps: 10 },
    { name: 'Deadlift', sets: 3, reps: 10 },
  ])
})

test('streak bỏ qua ngày nghỉ, hôm nay chưa tập không đứt chuỗi', () => {
  // 2026-11-19 là thứ 5. Lịch: T2, T3, T4, T5. Đã tập T2 T3 T4, hôm nay chưa.
  const sched = { 1: 1, 2: 1, 3: 1, 4: 1 }
  const done = new Set(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-13'])
  expect(streak(done, sched, new Date(2026, 10, 19))).toBe(4) // T5 tuần trước cũng tính, T6-CN nghỉ
  done.delete('2026-11-17')
  expect(streak(done, sched, new Date(2026, 10, 19))).toBe(1)
})

test('weekStats chỉ tính ngày có ghi, đếm ngày đủ protein / vượt kcal', async () => {
  const { weekStats } = await import('./calc')
  const L = (date, kcal, p) => ({ date, kcal, p, c: 0, f: 0 })
  const logs = [L('2026-11-24', 2000, 100), L('2026-11-24', 300, 40), L('2026-11-22', 1500, 80), L('2026-11-10', 9999, 9)]
  const s = weekStats(logs, '2026-11-24', { kcal: 2100, p: 136 })
  expect(s).toEqual({ days: 2, kcal: 1900, p: 110, proteinDays: 1, overDays: 1 }) // 11-10 nằm ngoài 7 ngày
  expect(weekStats([], '2026-11-24', null)).toBeNull()
})

test('bestE1rm và liftSeries', async () => {
  const { bestE1rm, liftSeries } = await import('./calc')
  expect(bestE1rm([{ kg: 60, reps: 10 }, { kg: 70, reps: 5 }, { kg: 0, reps: 12 }])).toBe(81.7) // 70*(1+5/30)
  expect(bestE1rm([])).toBe(0)
  const ss = [
    { date: '2026-11-20', exercise: 'Bench', sets: [{ kg: 60, reps: 8 }] },
    { date: '2026-11-13', exercise: 'Bench', sets: [{ kg: 55, reps: 8 }] },
    { date: '2026-11-20', exercise: 'Squat', sets: [{ kg: 80, reps: 5 }] },
  ]
  expect(liftSeries(ss, 'Bench').map((x) => [x.date, x.e1rm, x.top])).toEqual([['2026-11-13', 69.7, 55], ['2026-11-20', 76, 60]])
})

test('proteinPicks ưu tiên protein/kcal, bỏ món theo phần, giới hạn 300g', async () => {
  const { proteinPicks } = await import('./calc')
  const foods = [
    { name: 'Ức gà', unit: 'g', kcal: 165, p: 31 },
    { name: 'Hạt điều', unit: 'g', kcal: 553, p: 18 },
    { name: 'Trứng', unit: 'phần', kcal: 78, p: 6 },
    { name: 'Cơm', unit: 'g', kcal: 130, p: 2.7 },
  ]
  const r = proteinPicks(foods, 40)
  expect(r.map((x) => x.name)).toEqual(['Ức gà', 'Hạt điều'])
  expect(r[0]).toMatchObject({ grams: 130, pAdd: 40, kcalAdd: 215 })
  expect(r[1].grams).toBe(220)
  expect(proteinPicks(foods, 500)[0]).toMatchObject({ grams: 130, pAdd: 40 }) // thiếu nhiều vẫn chỉ gợi ý cỡ 1 bữa phụ
  expect(proteinPicks([{ name: 'Đậu', unit: 'g', kcal: 300, p: 10 }], 60)[0].grams).toBe(300) // tối đa 300g
  expect(proteinPicks(foods, 0)).toEqual([])
})

test('qtyLabel: g, ml cho món lỏng, phần', () => {
  expect(qtyLabel({ unit: 'g' })).toBe('g')
  expect(qtyLabel({ unit: 'g', liq: true })).toBe('ml')
  expect(qtyLabel({ unit: 'phần' })).toBe(' phần')
})
