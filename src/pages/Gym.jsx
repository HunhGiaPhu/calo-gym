import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting, useSetting } from '../db'
import { today, parsePlan, planToText, nextKg } from '../calc'

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function ExerciseLog({ ex, date, startRest, restSec, onSkip }) {
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
      <div className="row" style={{ margin: 0 }}>
        <h2 style={{ margin: 0 }}>{ex.name} <small className="muted">{ex.sets}x{ex.reps}</small></h2>
        <button className="x" onClick={onSkip} aria-label={`Bỏ bài ${ex.name} hôm nay`}>✕</button>
      </div>
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
    if (!name.trim()) return alert('Cần tên buổi tập')
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
  // Bài bỏ qua chỉ tính cho hôm nay: sang ngày khác tự hiện lại.
  const skipRow = useSetting('skip', null)
  const skipped = skipRow?.date === date ? skipRow.names : []
  const setSkipped = (names) => setSetting('skip', { date, names })
  const [openId, setOpenId] = useState(null)
  const [editing, setEditing] = useState(null)
  // Bài đã ghi hôm nay, để đánh dấu ✓ buổi đã tập.
  const doneToday = useLiveQuery(async () => new Set((await db.sessions.where('date').equals(date).toArray()).map((s) => s.exercise)), [date]) ?? new Set()

  // Bỏ tick = xoá số liệu set hôm nay của các bài trong buổi đó.
  const undoToday = async (x) => {
    if (!confirm(`Bỏ đánh dấu đã tập ${x.name} hôm nay?\nSố liệu set đã ghi hôm nay của buổi này sẽ bị xoá.`)) return
    const names = new Set(x.items.map((ex) => ex.name))
    await db.sessions.where('date').equals(date).filter((s) => names.has(s.exercise)).delete()
  }

  if (editing) return <WorkoutForm initial={editing} onDone={() => setEditing(null)} />

  const w = workouts.find((x) => x.id === openId)
  const todayId = schedule[new Date().getDay()]

  if (!w) {
    return (
      <>
        <h1>Tập</h1>
        <section>
          <h2>Chọn buổi tập</h2>
          {workouts.map((x) => {
            const done = x.items.some((ex) => doneToday.has(ex.name))
            return (
              <div key={x.id} className="row item">
                <button className="combo" onClick={() => setOpenId(x.id)}>
                  {x.name} <small className="muted">· {x.items.length} bài</small>
                  {x.id === todayId && <span className="badge">Hôm nay</span>}
                </button>
                {done && (
                  <button className="ghost" onClick={() => undoToday(x)} aria-label={`Bỏ đánh dấu đã tập ${x.name}`}>✓ Đã tập</button>
                )}
                <button className="ghost" onClick={() => setEditing(x)}>Sửa</button>
              </div>
            )
          })}
          <button className="ghost" onClick={() => setEditing({})}>+ Buổi tập mới</button>
        </section>

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
      </>
    )
  }

  return (
    <>
      <button className="ghost" onClick={() => setOpenId(null)}>← Quay lại</button>
      <h1>{w.name} <small className="muted" style={{ fontSize: '1rem', fontWeight: 400 }}>· {date.split('-').reverse().join('/')}</small></h1>
      {w.items.length > 0 && (
        <div className="row">
          <span className="muted">Nghỉ giữa set</span>
          <div className="seg">
            {[120, 150].map((s) => (
              <button key={s} className={restSec === s ? 'on' : ''} onClick={() => setSetting('restSec', s)}>{s}s</button>
            ))}
          </div>
        </div>
      )}
      {w.items.length === 0 && (
        <section>
          <p className="muted">Buổi {w.name} chưa có bài nào.</p>
          <button onClick={() => setEditing(w)}>+ Thêm bài cho {w.name}</button>
        </section>
      )}
      {w.items.filter((ex) => !skipped.includes(ex.name)).map((ex) => (
        <ExerciseLog key={`${w.id}-${ex.name}`} ex={ex} date={date} startRest={startRest} restSec={restSec}
          onSkip={() => setSkipped([...skipped, ex.name])} />
      ))}
      {skipped.some((n) => w.items.some((ex) => ex.name === n)) && (
        <section>
          <h2>Bỏ hôm nay</h2>
          {skipped.filter((n) => w.items.some((ex) => ex.name === n)).map((n) => (
            <div key={n} className="row item">
              <span className="muted">{n}</span>
              <button className="ghost" onClick={() => setSkipped(skipped.filter((x) => x !== n))}>Hiện lại</button>
            </div>
          ))}
        </section>
      )}
    </>
  )
}
