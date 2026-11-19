import { expect, test } from 'vitest'
import { nutrients, targets, parsePlan, streak } from './calc'

test('nutrients theo gram và theo phần', () => {
  expect(nutrients({ unit: 'g', kcal: 165, p: 31, c: 0, f: 3.6 }, 400)).toEqual({ kcal: 660, p: 124, c: 0, f: 14.4 })
  expect(nutrients({ unit: 'phần', kcal: 35, p: 1, c: 7, f: 0 }, 3).kcal).toBe(105)
})

test('targets: nam 70kg 175cm 21t', () => {
  const t = targets({ sex: 'nam', age: 21, height: 175, weight: 70, activity: 1.55, deficit: 400 })
  expect(t.tdee).toBe(2625) // bmr 1693.75 * 1.55
  expect(t.kcal).toBe(2225)
  expect(t.p).toBe(140)
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
