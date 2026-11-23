import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, useSetting } from '../db'
import { today, sumLogs, targets } from '../calc'
import { loadGis, backupToDrive } from '../drive'

// Vòng tiến độ SVG: đầy dần theo value/target, đỏ khi vượt.
function Ring({ value, target, size, stroke, label, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = target ? Math.min(1, value / target) : 0
  return (
    <div className={`ring${target && value > target ? ' over' : ''}`} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} aria-hidden="true">
        <circle className="track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle className="fill" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <div className="ring-in" aria-hidden="true">{children}</div>
    </div>
  )
}

const MACROS = [['p', '🥩', 'Protein'], ['c', '🍚', 'Carb'], ['f', '🧈', 'Fat']]

// Dòng nhỏ dưới tên món: protein / carb / fat của riêng món đó (dùng chung cho tab Ăn).
export const Macros = ({ l }) => <small className="mac">🥩 {Math.round(l.p)}g · 🍚 {Math.round(l.c)}g · 🧈 {Math.round(l.f)}g</small>

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
  const [driveMsg, setDriveMsg] = useState('')
  const [dateLabel] = useState(() => new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' }))
  // Tải sẵn thư viện Google khi cần nhắc, để bấm nút là mở cửa sổ đăng nhập được ngay (iPhone chặn nếu chờ).
  useEffect(() => { if (backupOld) loadGis().catch(() => {}) }, [backupOld])
  const doDrive = () => {
    setDriveMsg('Đang lưu lên Drive…')
    backupToDrive()
      .then(() => setDriveMsg('Đã lưu lên Drive ✓'))
      .catch((err) => setDriveMsg(`Chưa lưu được: ${err.message}`))
  }

  return (
    <>
      <p className="muted" style={{ margin: '8px 0 0', textTransform: 'capitalize' }}>{dateLabel}</p>
      <h1 style={{ marginTop: 0 }}>Hôm nay</h1>
      {!profile && <p className="note" onClick={() => go('progress')}>Chưa có chỉ số cơ thể. Bấm để nhập ở tab Tiến độ.</p>}
      <section className="hero">
        <Ring value={s.kcal} target={t?.kcal} size={196} stroke={14}
          label={t ? `Đã ăn ${Math.round(s.kcal)} trên ${t.kcal} kcal` : `Đã ăn ${Math.round(s.kcal)} kcal`}>
          <div className="ring-num">{t ? Math.abs(Math.round(t.kcal - s.kcal)) : Math.round(s.kcal)}</div>
          <div className="ring-lbl">🔥 {!t ? 'kcal đã ăn' : s.kcal > t.kcal ? 'kcal vượt' : 'kcal còn lại'}</div>
        </Ring>
        <div className="hero-sub">
          <div>Đã ăn<b>{Math.round(s.kcal)}</b></div>
          <div>Mục tiêu<b>{t?.kcal ?? '–'}</b></div>
        </div>
      </section>
      <div className="macro-grid">
        {MACROS.map(([k, icon, name]) => {
          const goal = t?.[k]
          const left = goal ? Math.round(goal - s[k]) : null
          return (
            <div key={k} className="macro">
              <Ring value={s[k]} target={goal} size={64} stroke={6} label={`${name} ${Math.round(s[k])} trên ${goal ?? '?'} gam`}>{icon}</Ring>
              <b>{Math.round(s[k])}{goal ? `/${goal}` : ''}g</b>
              <span>{name}</span>
              {left !== null && <small>{left >= 0 ? `còn ${left}g` : `vượt ${-left}g`}</small>}
            </div>
          )
        })}
      </div>
      <section onClick={() => go('gym')}>
        <h2>Lịch tập</h2>
        <p>{w ? `Hôm nay: ${w.name}` : 'Hôm nay nghỉ'}</p>
      </section>
      <section>
        <h2>Đã ăn</h2>
        {logs.length === 0 && <p className="muted">Chưa ghi gì.</p>}
        {logs.map((l) => (
          <div key={l.id} className="row item">
            <span>{l.meal} · {l.name} {l.qty}{l.unit === 'g' ? 'g' : ' phần'}<Macros l={l} /></span>
            <span>{Math.round(l.kcal)} kcal <button className="x" onClick={() => db.logs.delete(l.id)}>✕</button></span>
          </div>
        ))}
        <button onClick={() => go('eat')}>+ Ghi món</button>
      </section>
      {(backupOld || driveMsg) && (
        <section>
          <h2>Backup</h2>
          {backupOld && (
            <>
              <p className="muted">Đã hơn 7 ngày chưa backup. Bấm 1 lần để lưu lên Drive.</p>
              <button onClick={doDrive} style={{ width: '100%' }}>Lưu vào Drive</button>
            </>
          )}
          {driveMsg && <p className="muted">{driveMsg}</p>}
        </section>
      )}
    </>
  )
}
