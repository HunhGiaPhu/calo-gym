import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting, useSetting } from '../db'
import { today, parsePlan, planToText, nextKg } from '../calc'

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function ExerciseLog({ ex, date, startRest, restSec }) {
  const hist = useLiveQuery(() => db.sessions.where('exercise').equals(ex.name).sortBy('date'), [ex.name]) ?? []
  const todayRow = hist.find((h) => h.date === date)
  const last = hist.filter((h) => h.date < date).at(-1)
  const sug = nextKg(ex, last)
  const [draft, setDraft] = useState(null)
  const [dirty, setDirty] = useState(false)

  // Set đã lưu hôm nay + các set còn trống, kg điền sẵn (đang tập > gợi ý tăng tạ > lần trước).
  const base = todayRow?.sets ?? []
  const fillKg = (i) => base.at(-1)?.kg ?? sug ?? last?.sets[i]?.kg ?? ''
  const sets = draft ?? [...base, ...Array.from({ length: Math.max(0, ex.sets - base.length) }, (_, j) => ({ kg: fillKg(base.length + j), reps: '' }))]

  const edit = (i, k, v) => { setDraft(sets.map((s, j) => (j === i ? { ...s, [k]: v } : s))); setDirty(true) }
  const save = async () => {
    const clean = sets.filter((s) => +s.reps > 0).map((s) => ({ kg: +s.kg || 0, reps: +s.reps }))
    if (!clean.length) { alert('Nhập ít nhất 1 set có số rep'); return false }
    await db.sessions.put({ ...(todayRow && { id: todayRow.id }), date, exercise: ex.name, sets: clean })
    setDraft(sets) // giữ các dòng trống còn lại
    setDirty(false)
    return true
  }
  const doneSet = async (i) => {
    if (!(+sets[i].reps > 0)) return alert('Nhập số rep của set này')
    if (await save()) startRest(restSec)
  }

  return (
    <section>
      <h2>{ex.name} <small className="muted">{ex.sets}x{ex.reps}</small></h2>
      {last && <p className="muted">Lần trước ({last.date}): {last.sets.map((s) => `${s.kg}kg×${s.reps}`).join(', ')}</p>}
      {sug && <p className="tip">Lần trước đủ rep, thử {sug}kg</p>}
      {sets.map((s, i) => (
        <div key={i} className="row set">
          <span>Set {i + 1}</span>
          <input type="number" inputMode="decimal" placeholder="kg" value={s.kg} onChange={(e) => edit(i, 'kg', e.target.value)} aria-label={`Kg set ${i + 1}`} />
          <input type="number" inputMode="numeric" placeholder={`${ex.reps} rep`} value={s.reps} onChange={(e) => edit(i, 'reps', e.target.value)} aria-label={`Rep set ${i + 1}`} />
          <button className={`check${base[i] && !dirty ? ' on' : ''}`} onClick={() => doneSet(i)} aria-label={`Xong set ${i + 1}, bắt đầu nghỉ`}>✓</button>
        </div>
      ))}
      <div className="row">
        <button className="ghost" onClick={() => { setDraft([...sets, { kg: sets.at(-1)?.kg ?? '', reps: '' }]); setDirty(true) }}>+ Set</button>
        {dirty && <button onClick={save}>Lưu</button>}
      </div>
    </section>
  )
}

function WorkoutForm({ initial, onDone }) {
  const [name, setName] = useState(initial.name ?? '')
  const [text, setText] = useState(planToText(initial.items ?? []))
  const save = async () => {
    const items = parsePlan(text)
    if (!name.trim() || !items.length) return alert('Cần tên buổi và ít nhất 1 bài')
    await db.workouts.put({ ...(initial.id && { id: initial.id }), name: name.trim(), items })
    onDone()
  }
  return (
    <section>
      <h2>{initial.id ? 'Sửa buổi tập' : 'Buổi tập mới'}</h2>
      <input placeholder="Tên (vd Pull day)" value={name} onChange={(e) => setName(e.target.value)} />
      <textarea rows={7} placeholder={'Mỗi dòng 1 bài, vd:\nLat pulldown 3x10\nBarbell row 4x8'} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row">
        <button onClick={save}>Lưu</button>
        <button className="ghost" onClick={onDone}>Huỷ</button>
        {initial.id && <button className="ghost" onClick={async () => { if (confirm('Xoá buổi này?')) { await db.workouts.delete(initial.id); onDone() } }}>Xoá</button>}
      </div>
    </section>
  )
}

export default function Gym({ startRest }) {
  const date = today()
  const workouts = useLiveQuery(() => db.workouts.toArray()) ?? []
  const schedule = useSetting('schedule', {})
  const restSec = useSetting('restSec', 120)
  const [chosen, setChosen] = useState(null)
  const [editing, setEditing] = useState(null)

  if (editing) return <WorkoutForm initial={editing} onDone={() => setEditing(null)} />

  const wid = chosen ?? schedule[new Date().getDay()]
  const w = workouts.find((x) => x.id === wid)

  return (
    <>
      <h1>Tập</h1>
      <select value={wid ?? ''} onChange={(e) => setChosen(e.target.value ? +e.target.value : 0)}>
        <option value="">Hôm nay nghỉ</option>
        {workouts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      {w && (
        <div className="row">
          <span className="muted">Nghỉ giữa set</span>
          <div className="seg">
            {[120, 150].map((s) => (
              <button key={s} className={restSec === s ? 'on' : ''} onClick={() => setSetting('restSec', s)}>{s}s</button>
            ))}
          </div>
        </div>
      )}
      {w?.items.map((ex) => <ExerciseLog key={`${w.id}-${ex.name}`} ex={ex} date={date} startRest={startRest} restSec={restSec} />)}

      <section>
        <h2>Lịch theo thứ</h2>
        {DAYS.map((d, i) => (
          <div key={i} className="row">
            <span>{d}</span>
            <select value={schedule[i] ?? ''} onChange={(e) => setSetting('schedule', { ...schedule, [i]: e.target.value ? +e.target.value : null })}>
              <option value="">Nghỉ</option>
              {workouts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
        ))}
      </section>

      <section>
        <h2>Các buổi tập</h2>
        {workouts.map((x) => (
          <div key={x.id} className="row item">
            <span>{x.name} <small className="muted">{x.items.length} bài</small></span>
            <button className="ghost" onClick={() => setEditing(x)}>Sửa</button>
          </div>
        ))}
        <button className="ghost" onClick={() => setEditing({})}>+ Buổi tập mới</button>
      </section>
    </>
  )
}
