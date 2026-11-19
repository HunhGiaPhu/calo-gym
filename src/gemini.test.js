import { expect, test } from 'vitest'
import { parseItems } from './gemini'

test('parseItems đổi về trên 100g và lọc rác', () => {
  const out = parseItems(JSON.stringify({ items: [
    { name: ' Ức gà luộc ', grams: 200, kcal: 330, p: 62, c: 0, f: 7.2 },
    { name: '', grams: 100, kcal: 10, p: 0, c: 0, f: 0 },        // không tên
    { name: 'Nước', grams: 0, kcal: 0, p: 0, c: 0, f: 0 },        // 0 gram
    { name: 'Cơm', grams: 150, kcal: 'abc', p: -1, c: 42, f: 0 }, // số bậy -> 0
  ] }))
  expect(out).toEqual([
    { name: 'Ức gà luộc', grams: 200, kcal: 165, p: 31, c: 0, f: 3.6 },
    { name: 'Cơm', grams: 150, kcal: 0, p: 0, c: 28, f: 0 },
  ])
  expect(parseItems('{}')).toEqual([])
  expect(() => parseItems('not json')).toThrow()
})
