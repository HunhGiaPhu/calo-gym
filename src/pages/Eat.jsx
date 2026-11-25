import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addLog } from '../db'
import { nutrients, addDays, sumLogs } from '../calc'
import { recognize } from '../gemini'
import Camera from '../Camera'
import { Macros } from './Today'

const MEALS = ['Sáng', 'Trưa', 'Tối', 'Phụ']

// Chỉ khớp món tính theo gram: món "theo phần" mà ghi số gram thì ra sai (50g thành 50 phần).
const findByName = (name) => db.foods.filter((f) => f.unit === 'g' && f.name.toLowerCase() === name.toLowerCase()).first()

// Món AI đoán: dùng lại món cùng tên nếu có, không thì thêm mới để combo dùng được.
async function foodFor(it) {
  const same = await findByName(it.name)
  if (same) {
    if (same.s == null && it.s != null) { // món trong danh sách chưa có đường: học số AI cho lần sau
      await db.foods.update(same.id, { s: it.s })
      return { ...same, s: it.s }
    }
    return same
  }
  const food = { name: it.name, unit: 'g', kcal: it.kcal, p: it.p, c: it.c, f: it.f, s: it.s }
  return { ...food, id: await db.foods.add(food) }
}

function PhotoLog({ date, meal }) {
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState(null)
  const [err, setErr] = useState('')

  const [cam, setCam] = useState(false)
  const [photo, setPhoto] = useState(null) // giữ ảnh hoặc lời kể để gửi lại khi người dùng sửa
  const [say, setSay] = useState('')
  const [notes, setNotes] = useState([])
  const [note, setNote] = useState('')

  const run = async (file, fix, mode) => {
    setBusy(true); setErr('')
    try {
      const found = await recognize(file, fix, mode)
      if (!found.length) {
        setErr(fix || typeof file === 'string' ? 'AI không ra món nào, thử nói rõ hơn.'
          : mode === 'label' ? 'Không đọc được nhãn, chụp thẳng và rõ bảng dinh dưỡng.' : 'Không nhận ra món nào, thử chụp gần và rõ hơn.')
        if (fix) return // sửa hỏng thì giữ bảng cũ
      }
      // Món có trong danh sách thì lấy số của danh sách, không có thì dùng số Gemini tự tra.
      setItems(await Promise.all(found.map(async (it) => {
        const f = await findByName(it.name)
        return { ...it, ...(f && { kcal: f.kcal, p: f.p, c: f.c, f: f.f, s: f.s ?? it.s }), fromList: !!f, on: true }
      })))
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setBusy(false)
    }
  }
  const onFile = (file, mode) => { setCam(false); setPhoto({ file, mode }); setNotes([]); setItems(null); run(file, undefined, mode) }
  const onSay = () => { const t = say.trim(); if (!t || busy) return; setSay(''); onFile(t) }
  const sendFix = () => {
    const t = note.trim()
    if (!t || busy) return
    setNotes([...notes, t]); setNote('')
    run(photo.file, { prev: items, note: t }, photo.mode)
  }
  const edit = (i, patch) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  const saveAll = async (m) => {
    for (const it of items.filter((x) => x.on && +x.grams > 0)) {
      // Lưu món theo số AI đoán, rồi ghi theo gram người dùng đã sửa.
      await addLog(date, m, await foodFor(it), +it.grams)
    }
    setItems(null)
  }

  return (
    <section>
      <h2>Thêm món</h2>
      <div className="row addbtns">
        <button disabled={busy} onClick={() => setCam(true)}>{busy ? 'Đang nhận diện…' : '📷 Chụp món'}</button>
        {!busy && (
          <label className="btn ghost">🖼 Gửi ảnh
            <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) onFile(f) }} />
          </label>
        )}
        {!busy && (
          <label className="btn ghost" title="Chụp bảng dinh dưỡng trên bao bì">🏷 Nhãn
            <input type="file" accept="image/*" capture="environment" hidden aria-label="Chụp nhãn dinh dưỡng"
              onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) onFile(f, 'label') }} />
          </label>
        )}
      </div>
      <form className="row say" onSubmit={(e) => { e.preventDefault(); onSay() }}>
        <input placeholder="Hoặc nhắn món đã ăn, vd: 2 trứng luộc, 1 chén cơm" value={say} maxLength={300}
          onChange={(e) => setSay(e.target.value)} aria-label="Nhắn AI món đã ăn" />
        <button disabled={busy || !say.trim()}>Gửi</button>
      </form>
      {cam && <Camera onPick={onFile} onClose={() => setCam(false)} />}
      {err && <p className="note">{err}</p>}
      {items?.length > 0 && (
        <>
          <p className="muted">AI chỉ ước lượng, sửa lại số gram cho đúng rồi ghi. * = số do AI tra, không có trong danh sách món.</p>
          <table className="macros">
            <thead><tr><th>Món</th><th>Gram</th><th aria-label="Kcal" title="Kcal">🔥</th><th aria-label="Protein" title="Protein">🥩</th><th aria-label="Carb" title="Carb">🍚</th><th aria-label="Fat" title="Fat">🧈</th><th aria-label="Đường" title="Đường">🍬</th></tr></thead>
            <tbody>
              {items.map((it, i) => {
                const n = nutrients({ unit: 'g', ...it }, +it.grams || 0)
                return (
                  <tr key={i} className={it.on ? '' : 'off'}>
                    <td>
                      <label><input type="checkbox" checked={it.on} onChange={(e) => edit(i, { on: e.target.checked })} /> {it.name}{!it.fromList && '*'}</label>
                    </td>
                    <td><input type="number" inputMode="decimal" value={it.grams} onChange={(e) => edit(i, { grams: e.target.value })} aria-label={`Gram ${it.name}`} /></td>
                    <td>{Math.round(n.kcal)}</td><td>{n.p}</td><td>{n.c}</td><td>{n.f}</td><td>{n.s ?? '–'}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              {(() => {
                const t = sumLogs(items.filter((x) => x.on).map((it) => nutrients({ unit: 'g', ...it }, +it.grams || 0)))
                return <tr><td>Tổng</td><td /><td>{Math.round(t.kcal)}</td><td>{Math.round(t.p)}</td><td>{Math.round(t.c)}</td><td>{Math.round(t.f)}</td><td>{Math.round(t.s)}</td></tr>
              })()}
            </tfoot>
          </table>
          <div className="fix">
            {notes.map((t, i) => <p key={i} className="bubble">{t}</p>)}
            <form className="row" onSubmit={(e) => { e.preventDefault(); sendFix() }}>
              <input placeholder="Sửa món, vd: bánh gạo phô mai, không phải bơ" value={note} maxLength={300}
                onChange={(e) => setNote(e.target.value)} aria-label="Nhắn AI sửa lại món" />
              <button disabled={busy || !note.trim()}>{busy ? '…' : 'Sửa'}</button>
            </form>
          </div>
          <p className="muted">Ghi vào bữa:</p>
          <div className="meals">
            {MEALS.map((m) => <button key={m} className={m === meal ? '' : 'ghost'} onClick={() => saveAll(m)}>{m}</button>)}
          </div>
          <button className="ghost" onClick={() => setItems(null)} style={{ width: '100%', marginTop: 8 }}>Huỷ</button>
        </>
      )}
    </section>
  )
}

export default function Eat({ day: date, setDay: setDate }) {
  const [meal, setMeal] = useState(MEALS[0])

  const combos = useLiveQuery(() => db.combos.toArray()) ?? []
  const logs = useLiveQuery(() => db.logs.where('date').equals(date).toArray(), [date]) ?? []

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

  // Lưu 1 bữa (m) hoặc cả ngày (m = null) thành combo. Combo cả ngày nhớ luôn bữa của từng món.
  const saveCombo = async (m) => {
    const src = m ? logs.filter((l) => l.meal === m) : logs
    if (!src.length) return alert('Chưa có món nào để lưu')
    const name = prompt('Tên combo?', m ? `${m} thường` : 'Ngày thường')
    if (!name) return
    await db.combos.add({
      name,
      items: src.map((l) => ({ foodId: l.foodId, qty: l.qty, meal: m ? null : l.meal })),
    })
  }

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
        <h2>Đã ghi ngày {date}</h2>
        {logs.map((l) => (
          <div key={l.id} className="row item">
            <span>{l.meal} · {l.name} {l.qty}{l.unit === 'g' ? 'g' : ' phần'}<Macros l={l} /></span>
            <span>{Math.round(l.kcal)} kcal <button className="x" onClick={() => db.logs.delete(l.id)}>✕</button></span>
          </div>
        ))}
        <button className="ghost" onClick={copyYesterday} style={{ width: '100%', marginTop: 8 }}>Ăn lại như hôm trước</button>
        <p className="muted">Lưu thành combo:</p>
        <div className="meals">
          {MEALS.map((m) => (
            <button key={m} className="ghost" disabled={!logs.some((l) => l.meal === m)} onClick={() => saveCombo(m)}>{m}</button>
          ))}
        </div>
        <button className="ghost" disabled={!logs.length} onClick={() => saveCombo(null)} style={{ width: '100%', marginTop: 8 }}>Lưu cả ngày</button>
      </section>
    </>
  )
}
