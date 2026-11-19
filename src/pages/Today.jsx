import { useLiveQuery } from 'dexie-react-hooks'
import { db, useSetting } from '../db'
import { today, sumLogs, targets } from '../calc'

export function Meter({ label, value, target, unit }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0
  return (
    <div className="meter">
      <div className="row"><span>{label}</span><b>{Math.round(value)} / {target ?? '?'} {unit}</b></div>
      <div className="bar"><i style={{ width: `${pct}%` }} className={value > target ? 'over' : ''} /></div>
    </div>
  )
}

export default function Today({ go }) {
  const d = today()
  const logs = useLiveQuery(() => db.logs.where('date').equals(d).toArray(), [d]) ?? []
  const workouts = useLiveQuery(() => db.workouts.toArray()) ?? []
  const profile = useSetting('profile', null)
  const schedule = useSetting('schedule', {})
  const lastBackup = useSetting('lastBackup', null)

  const t = profile ? targets(profile) : null
  const s = sumLogs(logs)
  const w = workouts.find((x) => x.id === schedule[new Date().getDay()])
  const hasData = useLiveQuery(() => db.logs.count()) > 0
  const backupOld = hasData && (!lastBackup || Date.now() - lastBackup > 7 * 864e5)

  return (
    <>
      <h1>Hôm nay</h1>
      {!profile && <p className="note" onClick={() => go('progress')}>Chưa có chỉ số cơ thể. Bấm để nhập ở tab Tiến độ.</p>}
      <section>
        {t && <p className="big">{Math.round(t.kcal - s.kcal)} <small>kcal còn lại</small></p>}
        <Meter label="Kcal" value={s.kcal} target={t?.kcal} unit="" />
        <Meter label="Protein" value={s.p} target={t?.p} unit="g" />
        <Meter label="Carb" value={s.c} target={t?.c} unit="g" />
        <Meter label="Fat" value={s.f} target={t?.f} unit="g" />
      </section>
      <section onClick={() => go('gym')}>
        <h2>Lịch tập</h2>
        <p>{w ? `Hôm nay: ${w.name}` : 'Hôm nay nghỉ'}</p>
      </section>
      <section>
        <h2>Đã ăn</h2>
        {logs.length === 0 && <p className="muted">Chưa ghi gì.</p>}
        {logs.map((l) => (
          <div key={l.id} className="row item">
            <span>{l.meal} · {l.name} {l.qty}{l.unit === 'g' ? 'g' : ' phần'}</span>
            <span>{Math.round(l.kcal)} kcal <button className="x" onClick={() => db.logs.delete(l.id)}>✕</button></span>
          </div>
        ))}
        <button onClick={() => go('eat')}>+ Ghi món</button>
      </section>
      {backupOld && <p className="note" onClick={() => go('progress')}>Đã hơn 7 ngày chưa backup. Bấm để backup.</p>}
    </>
  )
}
