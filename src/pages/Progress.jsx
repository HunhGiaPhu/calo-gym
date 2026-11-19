import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { db, setSetting, useSetting, exportAll, importAll } from '../db'
import { today, toDate, targets, streak, ACTIVITY } from '../calc'

const DEFAULT_PROFILE = { sex: 'nam', age: 20, height: 170, weight: 65, activity: 1.55, deficit: 400 }

function ProfileForm({ profile }) {
  const [p, setP] = useState(profile ?? DEFAULT_PROFILE)
  const set = (k, num = true) => (e) => setP({ ...p, [k]: num ? +e.target.value : e.target.value })
  const t = targets(p)
  return (
    <section>
      <h2>Chỉ số cơ thể</h2>
      <div className="grid4">
        <label>Giới<select value={p.sex} onChange={set('sex', false)}><option value="nam">Nam</option><option value="nữ">Nữ</option></select></label>
        <label>Tuổi<input type="number" value={p.age} onChange={set('age')} /></label>
        <label>Cao (cm)<input type="number" value={p.height} onChange={set('height')} /></label>
        <label>Nặng (kg)<input type="number" inputMode="decimal" value={p.weight} onChange={set('weight')} /></label>
      </div>
      <label>Vận động<select value={p.activity} onChange={set('activity')}>
        {ACTIVITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select></label>
      <label>Thâm hụt (kcal/ngày, 300–500 để giảm mỡ)<input type="number" value={p.deficit} onChange={set('deficit')} /></label>
      <p className="muted">TDEE {t.tdee} → mục tiêu {t.kcal} kcal · P {t.p}g · C {t.c}g · F {t.f}g. Đây là ước lượng: theo dõi cân 2–3 tuần rồi chỉnh.</p>
      <button onClick={() => setSetting('profile', p)}>Lưu</button>
    </section>
  )
}

export default function Progress() {
  const profile = useSetting('profile', null)
  const schedule = useSetting('schedule', {})
  const weights = useLiveQuery(() => db.weights.orderBy('date').toArray()) ?? []
  const sessionDates = useLiveQuery(async () => new Set(await db.sessions.orderBy('date').uniqueKeys())) ?? new Set()
  const [kg, setKg] = useState('')

  // Kcal 14 ngày gần nhất
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 13 + i); return toDate(d) })
  const logs = useLiveQuery(() => db.logs.where('date').between(days[0], days[13], true, true).toArray(), [days[0]]) ?? []
  const kcalData = days.map((d) => ({ d: d.slice(5), kcal: Math.round(logs.filter((l) => l.date === d).reduce((s, l) => s + l.kcal, 0)) }))
  const target = profile ? targets(profile).kcal : null

  const saveWeight = async () => {
    if (!(+kg > 0)) return
    await db.weights.put({ date: today(), kg: +kg })
    if (profile) await setSetting('profile', { ...profile, weight: +kg }) // mục tiêu kcal đi theo cân nặng mới
    setKg('')
  }

  const doExport = async () => {
    const blob = new Blob([JSON.stringify(await exportAll())], { type: 'application/json' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `calo-gym-backup-${today()}.json` })
    a.click()
    URL.revokeObjectURL(a.href)
    await setSetting('lastBackup', Date.now())
  }

  const doImport = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file || !confirm('Nhập backup sẽ THAY TOÀN BỘ dữ liệu hiện tại. Tiếp tục?')) return
    try {
      await importAll(JSON.parse(await file.text()))
      alert('Đã nhập xong')
    } catch (err) {
      alert(`Không nhập được: ${err.message}`)
    }
  }

  return (
    <>
      <h1>Tiến độ</h1>
      <section>
        <h2>Streak</h2>
        <p className="big">{streak(sessionDates, schedule)} <small>buổi liên tiếp</small></p>
        <p className="muted">Tính các ngày có lịch tập liên tiếp đã tập. Ngày nghỉ không làm đứt chuỗi.</p>
      </section>

      <section>
        <h2>Cân nặng</h2>
        <div className="row">
          <input type="number" inputMode="decimal" placeholder="kg hôm nay" value={kg} onChange={(e) => setKg(e.target.value)} />
          <button onClick={saveWeight}>Ghi</button>
        </div>
        {weights.length > 1 && (
          <div className="chart"><ResponsiveContainer width="100%" height={200}>
            <LineChart data={weights}>
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={11} />
              <YAxis domain={['dataMin - 1', 'dataMax + 1']} fontSize={11} width={32} />
              <Tooltip />
              <Line dataKey="kg" stroke="currentColor" dot={false} strokeWidth={2.5} />
            </LineChart>
          </ResponsiveContainer></div>
        )}
      </section>

      <section>
        <h2>Kcal 14 ngày</h2>
        <div className="chart"><ResponsiveContainer width="100%" height={200}>
          <BarChart data={kcalData}>
            <XAxis dataKey="d" fontSize={11} axisLine={false} tickLine={false} />
            <YAxis fontSize={11} width={40} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'transparent' }} />
            {target && <ReferenceLine y={target} strokeDasharray="4 4" />}
            <Bar dataKey="kcal" fill="currentColor" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer></div>
      </section>

      <ProfileForm key={profile ? 'p' : 'new'} profile={profile} />

      <section>
        <h2>Backup</h2>
        <p className="muted">Dữ liệu chỉ nằm trong máy này. Backup ra file rồi lưu lên Drive cho chắc.</p>
        <div className="row">
          <button onClick={doExport}>Xuất backup</button>
          <label className="btn ghost">Nhập backup<input type="file" accept=".json" hidden onChange={doImport} /></label>
        </div>
      </section>
    </>
  )
}
