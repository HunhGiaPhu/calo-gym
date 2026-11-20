import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { today, nutrients, addDays, sumLogs } from '../calc'
import { recognize } from '../gemini'
import Camera from '../Camera'

const MEALS = ['Sáng', 'Trưa', 'Tối', 'Phụ']
const EMPTY = { name: '', unit: 'g', kcal: '', p: '', c: '', f: '' }

const addLog = (date, meal, food, qty) =>
  db.logs.add({ date, meal, foodId: food.id, name: food.name, unit: food.unit, qty, ...nutrients(food, qty) })

// Chỉ khớp món tính theo gram: món "theo phần" mà ghi số gram thì ra sai (50g thành 50 phần).
const findByName = (name) => db.foods.filter((f) => f.unit === 'g' && f.name.toLowerCase() === name.toLowerCase()).first()

// Món AI đoán: dùng lại món cùng tên nếu có, không thì thêm mới để combo dùng được.
async function foodFor(it) {
  const same = await findByName(it.name)
  if (same) return same
  const food = { name: it.name, unit: 'g', kcal: it.kcal, p: it.p, c: it.c, f: it.f }
  return { ...food, id: await db.foods.add(food) }
}

function PhotoLog({ date, meal }) {
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState(null)
  const [err, setErr] = useState('')

  const [cam, setCam] = useState(false)

  const onFile = async (file) => {
    setCam(false)
    setBusy(true); setErr(''); setItems(null)
    try {
      const found = await recognize(file)
      if (!found.length) setErr('Không nhận ra món nào, thử chụp gần và rõ hơn.')
      // Món có trong danh sách thì lấy số của danh sách, không có thì dùng số Gemini tự tra.
      setItems(await Promise.all(found.map(async (it) => {
        const f = await findByName(it.name)
        return { ...it, ...(f && { kcal: f.kcal, p: f.p, c: f.c, f: f.f }), fromList: !!f, on: true }
      })))
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setBusy(false)
    }
  }
  const edit = (i, patch) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  const saveAll = async () => {
    for (const it of items.filter((x) => x.on && +x.grams > 0)) {
      // Lưu món theo số AI đoán, rồi ghi theo gram người dùng đã sửa.
      await addLog(date, meal, await foodFor(it), +it.grams)
    }
    setItems(null)
  }

  return (
    <section>
      <h2>Chụp món</h2>
      <div className="row">
        <button disabled={busy} onClick={() => setCam(true)}>{busy ? 'Đang nhận diện…' : '📷 Chụp món'}</button>
        {!busy && (
          <label className="btn ghost">🖼 Gửi ảnh
            <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) onFile(f) }} />
          </label>
        )}
      </div>
      {cam && <Camera onPick={onFile} onClose={() => setCam(false)} />}
      {err && <p className="note">{err}</p>}
      {items?.length > 0 && (
        <>
          <p className="muted">AI chỉ ước lượng, sửa lại số gram cho đúng rồi ghi. * = số do AI tra, không có trong danh sách món.</p>
          <table className="macros">
            <thead><tr><th>Món</th><th>Gram</th><th>Kcal</th><th>P</th><th>C</th><th>F</th></tr></thead>
            <tbody>
              {items.map((it, i) => {
                const n = nutrients({ unit: 'g', ...it }, +it.grams || 0)
                return (
                  <tr key={i} className={it.on ? '' : 'off'}>
                    <td>
                      <label><input type="checkbox" checked={it.on} onChange={(e) => edit(i, { on: e.target.checked })} /> {it.name}{!it.fromList && '*'}</label>
                    </td>
                    <td><input type="number" inputMode="decimal" value={it.grams} onChange={(e) => edit(i, { grams: e.target.value })} aria-label={`Gram ${it.name}`} /></td>
                    <td>{Math.round(n.kcal)}</td><td>{n.p}</td><td>{n.c}</td><td>{n.f}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              {(() => {
                const t = sumLogs(items.filter((x) => x.on).map((it) => nutrients({ unit: 'g', ...it }, +it.grams || 0)))
                return <tr><td>Tổng</td><td /><td>{Math.round(t.kcal)}</td><td>{Math.round(t.p)}</td><td>{Math.round(t.c)}</td><td>{Math.round(t.f)}</td></tr>
              })()}
            </tfoot>
          </table>
          <div className="row">
            <button onClick={saveAll}>Ghi vào bữa {meal}</button>
            <button className="ghost" onClick={() => setItems(null)}>Huỷ</button>
          </div>
        </>
      )}
    </section>
  )
}

function FoodForm({ initial, onDone }) {
  const [f, setF] = useState(initial)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async () => {
    if (!f.name.trim() || f.kcal === '') return alert('Cần tên món và kcal')
    const row = { ...f, name: f.name.trim(), kcal: +f.kcal, p: +f.p || 0, c: +f.c || 0, f: +f.f || 0 }
    await db.foods.put(row)
    onDone()
  }
  const per = f.unit === 'g' ? '/100g' : '/1 phần'
  return (
    <section>
      <h2>{f.id ? 'Sửa món' : 'Món mới'}</h2>
      <input placeholder="Tên món" value={f.name} onChange={set('name')} />
      <select value={f.unit} onChange={set('unit')}>
        <option value="g">Tính theo gram</option>
        <option value="phần">Tính theo phần (cái, hộp, tô...)</option>
      </select>
      <div className="grid4">
        {[['kcal', 'Kcal'], ['p', 'Protein'], ['c', 'Carb'], ['f', 'Fat']].map(([k, l]) => (
          <label key={k}>{l} {per}<input type="number" inputMode="decimal" value={f[k]} onChange={set(k)} /></label>
        ))}
      </div>
      <div className="row"><button onClick={save}>Lưu</button><button className="ghost" onClick={onDone}>Huỷ</button></div>
    </section>
  )
}

export default function Eat() {
  const [date, setDate] = useState(today())
  const [meal, setMeal] = useState(MEALS[0])
  const [q, setQ] = useState('')
  const [pick, setPick] = useState(null)
  const [qty, setQty] = useState('')
  const [editing, setEditing] = useState(null)

  const foods = useLiveQuery(() => db.foods.orderBy('name').toArray()) ?? []
  const combos = useLiveQuery(() => db.combos.toArray()) ?? []
  const logs = useLiveQuery(() => db.logs.where('date').equals(date).toArray(), [date]) ?? []

  const matches = q ? foods.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())).slice(0, 15) : []

  const add = async () => {
    if (!(+qty > 0)) return alert('Nhập số lượng')
    await addLog(date, meal, pick, +qty)
    setPick(null); setQty(''); setQ('')
  }

  const applyCombo = async (c) => {
    let missing = 0
    for (const it of c.items) {
      const food = await db.foods.get(it.foodId)
      if (food) await addLog(date, it.meal ?? meal, food, it.qty)
      else missing++
    }
    if (missing) alert(`${missing} món trong combo không còn, đã bỏ qua`)
  }

  const copyYesterday = async () => {
    const prev = await db.logs.where('date').equals(addDays(date, -1)).toArray()
    if (!prev.length) return alert('Hôm trước chưa ghi gì')
    if (logs.length && !confirm(`Ngày ${date} đã có món. Vẫn chép thêm ${prev.length} món của hôm trước?`)) return
    await db.logs.bulkAdd(prev.map(({ id: _id, ...l }) => ({ ...l, date })))
  }

  // Lưu bữa đang chọn (hoặc cả ngày) thành combo. Combo cả ngày nhớ luôn bữa của từng món.
  const saveCombo = async (wholeDay) => {
    const src = wholeDay ? logs : logs.filter((l) => l.meal === meal)
    if (!src.length) return alert('Chưa có món nào để lưu')
    const name = prompt('Tên combo?', wholeDay ? 'Ngày thường' : `${meal} thường`)
    if (!name) return
    await db.combos.add({
      name,
      items: src.map((l) => ({ foodId: l.foodId, qty: l.qty, meal: wholeDay ? l.meal : null })),
    })
  }

  if (editing) return <FoodForm initial={editing} onDone={() => setEditing(null)} />

  return (
    <>
      <h1>Ăn</h1>
      <div className="row">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <select value={meal} onChange={(e) => setMeal(e.target.value)}>
          {MEALS.map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>

      <section>
        <h2>Combo</h2>
        {combos.length === 0 && <p className="muted">Ghi món xong rồi bấm "Lưu thành combo" bên dưới.</p>}
        {combos.map((c) => (
          <div key={c.id} className="row item">
            <button className="combo" onClick={() => applyCombo(c)}>{c.name} <small className="muted">· {c.items.length} món</small></button>
            <button className="x" onClick={() => confirm(`Xoá combo ${c.name}?`) && db.combos.delete(c.id)}>✕</button>
          </div>
        ))}
      </section>

      <PhotoLog date={date} meal={meal} />

      <section>
        <h2>Thêm món</h2>
        {pick ? (
          <>
            <p><b>{pick.name}</b> · {pick.kcal} kcal {pick.unit === 'g' ? '/100g' : '/phần'}</p>
            <div className="row">
              <input type="number" inputMode="decimal" autoFocus placeholder={pick.unit === 'g' ? 'Số gram' : 'Số phần'}
                value={qty} onChange={(e) => setQty(e.target.value)} />
              <button onClick={add}>Ghi</button>
              <button className="ghost" onClick={() => setPick(null)}>Huỷ</button>
            </div>
          </>
        ) : (
          <>
            <input placeholder="Tìm món..." value={q} onChange={(e) => setQ(e.target.value)} />
            {matches.map((f) => (
              <div key={f.id} className="row item">
                <span onClick={() => setPick(f)}>{f.name} <small className="muted">{f.kcal} kcal{f.unit === 'g' ? '/100g' : '/phần'}</small></span>
                <button className="ghost" onClick={() => setEditing(f)}>Sửa</button>
              </div>
            ))}
            <button className="ghost" onClick={() => setEditing({ ...EMPTY, name: q })}>+ Món mới</button>
          </>
        )}
      </section>

      <section>
        <h2>Đã ghi ngày {date}</h2>
        {logs.map((l) => (
          <div key={l.id} className="row item">
            <span>{l.meal} · {l.name} {l.qty}{l.unit === 'g' ? 'g' : ' phần'}</span>
            <span>{Math.round(l.kcal)} kcal <button className="x" onClick={() => db.logs.delete(l.id)}>✕</button></span>
          </div>
        ))}
        <button className="ghost" onClick={copyYesterday} style={{ width: '100%', marginTop: 8 }}>Ăn lại như hôm trước</button>
        <div className="row">
          <button className="ghost" onClick={() => saveCombo(false)}>Lưu bữa {meal} thành combo</button>
          <button className="ghost" onClick={() => saveCombo(true)}>Lưu cả ngày thành combo</button>
        </div>
      </section>
    </>
  )
}
