import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting, useSetting } from '../db'
import { today, parsePlan, planToText } from '../calc'

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function ExerciseLog({ ex, date }) {
  const hist = useLiveQuery(() => db.sessions.where('exercise').equals(ex.name).sortBy('date'), [ex.name]) ?? []
  const todayRow = hist.find((h) => h.date === date)
  const last = hist.filter((h) => h.date < date).at(-1)
  const [draft, setDraft] = useState(null)
  // Gợi ý kg từ lần trước để khỏi nhập lại.
  const sets = draft ?? todayRow?.sets ?? Array.from({ length: ex.sets }, (_, i) => ({ kg: last?.sets[i]?.kg ?? '', reps: '' }))

  const edit = (i, k, v) => setDraft(sets.map((s, j) => (j === i ? { ...s, [k]: v } : s)))
  const save = async () => {
    const clean = sets.filter((s) => +s.reps > 0).map((s) => ({ kg: +s.kg || 0, reps: +s.reps }))
    if (!clean.length) return alert('Nhập ít nhất 1 set có số rep')
    await db.sessions.put({ ...(todayRow && { id: todayRow.id }), date, exercise: ex.name, sets: clean })
    setDraft(null)
  }

  return (
    <section>
      <h2>{ex.name} <small className="muted">{ex.sets}x{ex.reps}</small></h2>
      {last && <p className="muted">Lần trước ({last.date}): {last.sets.map((s) => `${s.kg}kg×${s.reps}`).join(', ')}</p>}
      {sets.map((s, i) => (
        <div key={i} className="row set">
          <span>Set {i + 1}</span>
          <input type="number" inputMode="decimal" placeholder="kg" value={s.kg} onChange={(e) => edit(i, 'kg', e.target.value)} />
          <input type="number" inputMode="numeric" placeholder={`${ex.reps} rep`} value={s.reps} onChange={(e) => edit(i, 'reps', e.target.value)} />
        </div>
      ))}
      <div className="row">
        <button className="ghost" onClick={() => setDraft([...sets, { kg: sets.at(-1)?.kg ?? '', reps: '' }])}>+ Set</button>
        <button onClick={save}>{todayRow && !draft ? 'Đã lưu ✓' : 'Lưu'}</button>
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

export default function Gym() {
  const date = today()
  const workouts = useLiveQuery(() => db.workouts.toArray()) ?? []
  const schedule = useSetting('schedule', {})
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
      {w?.items.map((ex) => <ExerciseLog key={`${w.id}-${ex.name}`} ex={ex} date={date} />)}

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
