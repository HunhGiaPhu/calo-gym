import { expect, test } from 'vitest'
import { parseItems, fixPrompt } from './gemini'

test('fixPrompt gửi kèm danh sách cũ (gram người dùng đã sửa) và lời sửa đã cắt gọn', () => {
  const p = fixPrompt([{ name: 'Bánh gạo bơ', grams: '40' }, { name: 'Sữa', grams: '' }], '  bánh gạo phô mai, không phải bơ  ' + 'x'.repeat(400))
  expect(p).toContain('[["Bánh gạo bơ",40],["Sữa",0]]')
  expect(p).toContain('"bánh gạo phô mai, không phải bơ')
  expect(p).not.toContain('x'.repeat(301))
})

test('parseItems đổi về trên 100g và lọc rác', () => {
  const out = parseItems(JSON.stringify({ items: [
    { name: ' Ức gà luộc ', grams: 200, kcal: 330, p: 62, c: 0, f: 7.2, s: 0 },
    { name: '', grams: 100, kcal: 10, p: 0, c: 0, f: 0 },        // không tên
    { name: 'Nước', grams: 0, kcal: 0, p: 0, c: 0, f: 0 },        // 0 gram
    { name: 'Cơm', grams: 150, kcal: 'abc', p: -1, c: 42, f: 0, s: 'x' }, // số bậy -> 0
    { name: 'Nước ngọt', grams: 200, kcal: 80, p: 0, c: 20, f: 0, s: 20 },
  ] }))
  expect(out).toEqual([
    { name: 'Ức gà luộc', grams: 200, kcal: 165, p: 31, c: 0, f: 3.6, s: 0 },
    { name: 'Cơm', grams: 150, kcal: 0, p: 0, c: 28, f: 0, s: 0 },
    { name: 'Nước ngọt', grams: 200, kcal: 40, p: 0, c: 10, f: 0, s: 10 },
  ])
  expect(parseItems('{}')).toEqual([])
  expect(() => parseItems('not json')).toThrow()
})

test('textPrompt và fixPrompt cho lời kể: có lời kể, cắt gọn, sửa dựa trên lời kể', async () => {
  const { textPrompt, fixPrompt } = await import('./gemini')
  const t = textPrompt('  2 trứng luộc, 1 chén cơm  ' + 'y'.repeat(400))
  expect(t).toContain('"2 trứng luộc, 1 chén cơm')
  expect(t).not.toContain('y'.repeat(301))
  const f = fixPrompt([{ name: 'Trứng luộc', grams: 100 }], 'chỉ 1 quả thôi', t)
  expect(f.startsWith(t)).toBe(true)
  expect(f).toContain('[["Trứng luộc",100]]')
})
