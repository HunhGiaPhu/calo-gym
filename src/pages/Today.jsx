import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, useSetting, addLog, logWeight } from '../db'
import { today, addDays, sumLogs, targets, proteinPicks, qtyLabel, SUGAR_LIMIT } from '../calc'
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
export const Macros = ({ l }) => <small className="mac">🥩 {Math.round(l.p)}g · 🍚 {Math.round(l.c)}g · 🧈 {Math.round(l.f)}g{l.s != null && ` · 🍬 ${Math.round(l.s)}g`}</small>

const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

export default function Today({ go, day, setDay }) {
  const d = day
  const now = today()
  const wd = new Date(`${d}T00:00`).getDay()
  const dm = `${+d.slice(8)}/${+d.slice(5, 7)}`
  const title = d === now ? 'Hôm nay' : d === addDays(now, -1) ? 'Hôm qua' : dm
  const logs = useLiveQuery(() => db.logs.where('date').equals(d).toArray(), [d]) ?? []
  const workouts = useLiveQuery(() => db.workouts.toArray()) ?? []
  const profile = useSetting('profile', null)
  const schedule = useSetting('schedule', {})
  const lastBackup = useSetting('lastBackup', null)

  const t = profile ? targets(profile) : null
  const s = sumLogs(logs)
  const w = workouts.find((x) => x.id === schedule[wd])
  const hasData = useLiveQuery(() => db.logs.count()) > 0
  const weighed = useLiveQuery(() => db.weights.get(d), [d])
  const [kg, setKg] = useState('')
  // Chỉ gợi ý khi đang xem hôm nay và còn thiếu đáng kể (≥15g) protein.
  const needP = t && d === now ? Math.round(t.p - s.p) : 0
  const foods = useLiveQuery(() => (needP >= 15 ? db.foods.toArray() : []), [needP >= 15]) ?? []
  const picks = needP >= 15 ? proteinPicks(foods, needP) : []
  const backupOld = hasData && (!lastBackup || Date.now() - lastBackup > 7 * 864e5)
  const [driveMsg, setDriveMsg] = useState('')
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
      <p className="muted" style={{ margin: '8px 0 0' }}>{WEEKDAYS[wd]}, {dm}</p>
      <div className="daynav">
        <button className="ghost" onClick={() => setDay(addDays(d, -1))} aria-label="Xem ngày trước">‹</button>
        <h1>{title}</h1>
        <button className="ghost" onClick={() => setDay(addDays(d, 1))} disabled={d >= now} aria-label="Xem ngày sau">›</button>
        {d !== now && <button className="ghost today-btn" onClick={() => setDay(now)}>Về hôm nay</button>}
      </div>
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
      <div className={`sugar${s.s > SUGAR_LIMIT ? ' over' : ''}`} role="img" aria-label={`Đường ${Math.round(s.s)} trên ${SUGAR_LIMIT} gam`}>
        <span>🍬 Đường</span>
        <div className="bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (s.s / SUGAR_LIMIT) * 100)}%` }} /></div>
        <b>{Math.round(s.s)}/{SUGAR_LIMIT}g</b>
      </div>
      <section onClick={() => go('gym')}>
        <h2>Lịch tập</h2>
        <p>{w ? `${title}: ${w.name}` : `${title} nghỉ`}</p>
      </section>
      {picks.length > 0 && (
        <section>
          <h2>Còn thiếu {needP}g protein</h2>
          {picks.map((f) => (
            <div key={f.id} className="row item">
              <span>{f.name} {f.grams}g<small className="mac">🥩 +{f.pAdd}g · 🔥 +{f.kcalAdd} kcal</small></span>
              <button className="ghost" onClick={() => addLog(d, 'Phụ', f, f.grams)} aria-label={`Ghi ${f.name} ${f.grams}g vào bữa Phụ`}>+ Ghi</button>
            </div>
          ))}
          <p className="muted">Món trong danh sách có nhiều protein mà ít kcal nhất. Bấm Ghi là vào bữa Phụ; muốn đổi gram thì xoá rồi ghi ở tab Ăn.</p>
        </section>
      )}
      <section>
        <h2>Cân nặng</h2>
        <form className="row say" onSubmit={(e) => { e.preventDefault(); if (+kg > 0) { logWeight(+kg, d); setKg('') } }}>
          <input type="number" inputMode="decimal" step="0.1" value={kg} onChange={(e) => setKg(e.target.value)}
            placeholder={weighed ? `Đã cân ${weighed.kg} kg` : `kg ${title.toLowerCase()}`} aria-label="Cân nặng (kg)" />
          <button disabled={!(+kg > 0)}>{weighed ? 'Sửa' : 'Ghi'}</button>
        </form>
      </section>
      <section>
        <h2>Đã ăn</h2>
        {logs.length === 0 && <p className="muted">Chưa ghi gì.</p>}
        {logs.map((l) => (
          <div key={l.id} className="row item">
            <span>{l.meal} · {l.name} {l.qty}{qtyLabel(l)}<Macros l={l} /></span>
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
