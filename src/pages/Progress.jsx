import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { db, setSetting, useSetting, exportAll, importAll, logWeight } from '../db'
import { today, toDate, targets, streak, ACTIVITY, rolling7, weightAdvice, weekStats, liftSeries } from '../calc'
import { getKey, setKey, getModel, setModel, DEFAULT_MODEL } from '../gemini'
import { loadGis, backupToDrive, restoreFromDrive } from '../drive'

function GeminiForm() {
  const [key, setK] = useState(getKey())
  const [model, setM] = useState(getModel())
  const [saved, setSaved] = useState(false)
  return (
    <section>
      <h2>Chụp món (Gemini)</h2>
      <p className="muted">Lấy key ở aistudio.google.com/apikey. Key chỉ lưu trong máy này, không nằm trong file backup.</p>
      <label>API key<input type="password" autoComplete="off" value={key} onChange={(e) => { setK(e.target.value); setSaved(false) }} /></label>
      <label>Model<input value={model} placeholder={DEFAULT_MODEL} onChange={(e) => { setM(e.target.value); setSaved(false) }} /></label>
      <div className="row">
        <button onClick={() => { setKey(key); setModel(model); setSaved(true) }}>{saved ? 'Đã lưu ✓' : 'Lưu'}</button>
        {key && <button className="ghost" onClick={() => { setKey(''); setK(''); setSaved(false) }}>Xoá key</button>}
      </div>
    </section>
  )
}

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
  const advice = weightAdvice(weights)
  const applyAdvice = () => setSetting('profile', { ...profile, deficit: Math.min(1000, Math.max(0, profile.deficit + advice.adjust)) })
  // Không dùng uniqueKeys(): Safari iOS lỗi "Unable to open cursor" với key cursor.
  const sessions = useLiveQuery(() => db.sessions.toArray()) ?? []
  const sessionDates = new Set(sessions.map((x) => x.date))
  // Bài tập theo số buổi đã ghi, nhiều nhất lên đầu.
  const lifts = Object.entries(sessions.reduce((m, x) => { m[x.exercise] = (m[x.exercise] || 0) + 1; return m }, {}))
    .sort((a, b) => b[1] - a[1]).map(([n]) => n)
  const [lift, setLift] = useState('')
  const liftName = lifts.includes(lift) ? lift : lifts[0]
  const series = liftName ? liftSeries(sessions, liftName) : []
  const pr = series.reduce((b, x) => (x.e1rm > (b?.e1rm ?? 0) ? x : b), null)
  const [kg, setKg] = useState('')

  // Kcal 14 ngày gần nhất
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 13 + i); return toDate(d) })
  const logs = useLiveQuery(() => db.logs.where('date').between(days[0], days[13], true, true).toArray(), [days[0]]) ?? []
  const kcalData = days.map((d) => ({ d: d.slice(5), kcal: Math.round(logs.filter((l) => l.date === d).reduce((s, l) => s + l.kcal, 0)) }))
  const t = profile ? targets(profile) : null
  const target = t?.kcal ?? null
  const week = weekStats(logs, today(), t)

  const saveWeight = async () => {
    if (!(+kg > 0)) return
    await logWeight(+kg)
    setKg('')
  }

  const doExport = async () => {
    const file = new File([JSON.stringify(await exportAll())], `calo-gym-backup-${today()}.json`, { type: 'application/json' })
    // iPhone: mở bảng Chia sẻ để chọn Drive / Lưu vào Tệp. Máy không hỗ trợ thì tải file về.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Backup Calo Gym' })
      } catch (err) {
        if (err.name === 'AbortError') return // người dùng bấm huỷ: chưa tính là đã backup
        alert(`Không chia sẻ được: ${err.message}`)
        return
      }
    } else {
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: file.name })
      a.click()
      URL.revokeObjectURL(a.href)
    }
    await setSetting('lastBackup', Date.now())
  }

  // Tải sẵn thư viện Google để lúc bấm nút mở được cửa sổ đăng nhập ngay.
  const [driveMsg, setDriveMsg] = useState('')
  useEffect(() => { loadGis().catch(() => {}) }, [])
  const doDrive = () => {
    setDriveMsg('Đang lưu lên Drive…')
    backupToDrive()
      .then(() => {
        setDriveMsg(`Đã lưu lên Drive lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ✓`)
      })
      .catch((err) => setDriveMsg(`Chưa lưu được: ${err.message}`))
  }

  const doRestore = () => {
    setDriveMsg('Đang lấy bản backup từ Drive…')
    restoreFromDrive((d, at) => confirm(`Bản trên Drive lưu lúc ${at.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })} (${d?.logs?.length ?? 0} món đã ghi, ${d?.weights?.length ?? 0} lần cân).

Khôi phục sẽ THAY TOÀN BỘ dữ liệu trong máy bằng bản này; món ghi sau giờ đó sẽ mất. Muốn giữ bản hiện tại thì huỷ và bấm "Chia sẻ file" trước. Tiếp tục?`))
      .then((ok) => setDriveMsg(ok ? 'Đã khôi phục từ Drive ✓' : 'Đã huỷ khôi phục.'))
      .catch((err) => setDriveMsg(`Chưa khôi phục được: ${err.message}`))
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
            <LineChart data={rolling7(weights)}>
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={11} axisLine={false} tickLine={false} />
              <YAxis domain={['dataMin - 1', 'dataMax + 1']} fontSize={11} width={32} axisLine={false} tickLine={false} />
              <Tooltip />
              {/* chấm mờ = cân từng ngày, đường đậm = trung bình 7 ngày (mới là xu hướng thật) */}
              <Line dataKey="kg" name="Cân" stroke="currentColor" strokeOpacity={0.35} dot={{ r: 2 }} strokeWidth={1} />
              <Line dataKey="avg" name="TB 7 ngày" stroke="currentColor" dot={false} strokeWidth={2.5} />
            </LineChart>
          </ResponsiveContainer></div>
        )}
        {advice ? (
          <div className="tip">
            <p>TB 7 ngày: {advice.change > 0 ? '+' : ''}{advice.change}kg/tuần ({advice.pct}%). {advice.msg}.</p>
            {advice.adjust !== 0 && profile && (
              <button onClick={applyAdvice}>
                {advice.adjust > 0 ? `Ăn bớt 150 kcal/ngày` : `Ăn thêm 150 kcal/ngày`}
              </button>
            )}
          </div>
        ) : (
          <p className="muted">Cân buổi sáng, ít nhất 3 lần/tuần. Đủ 2 tuần thì app gợi ý chỉnh kcal.</p>
        )}
      </section>

      <section>
        <h2>7 ngày qua</h2>
        {week ? (
          <>
            <div className="stats">
              <div><b>{week.kcal}</b><span>🔥 kcal TB/ngày{t ? ` · mục tiêu ${t.kcal}` : ''}</span></div>
              <div><b>{week.p}g</b><span>🥩 protein TB/ngày{t ? ` · mục tiêu ${t.p}g` : ''}</span></div>
              {t && <div><b>{week.proteinDays}/{week.days}</b><span>ngày đủ protein</span></div>}
              {t && <div><b>{week.overDays}/{week.days}</b><span>ngày vượt kcal</span></div>}
            </div>
            <p className="muted">Tính {week.days} ngày có ghi món, ngày không ghi bỏ qua.</p>
          </>
        ) : <p className="empty-state"><span aria-hidden="true">🍽</span>7 ngày qua chưa ghi món nào</p>}
      </section>

      <section>
        <h2>Tiến bộ tạ</h2>
        {lifts.length === 0 ? <p className="empty-state"><span aria-hidden="true">🏋️</span>Ghi set ở tab Tập để xem tiến bộ từng bài</p> : (
          <>
            <select value={liftName} onChange={(e) => setLift(e.target.value)} aria-label="Chọn bài tập">
              {lifts.map((n) => <option key={n}>{n}</option>)}
            </select>
            {pr && <p className="big">{pr.e1rm} <small>kg · 1RM ước tính cao nhất ({pr.date.slice(8)}/{pr.date.slice(5, 7)})</small></p>}
            {series.length > 1 ? (
              <div className="chart"><ResponsiveContainer width="100%" height={180}>
                <LineChart data={series}>
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis domain={['dataMin - 5', 'dataMax + 5']} fontSize={11} width={36} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Line dataKey="e1rm" name="1RM ước tính" stroke="currentColor" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line dataKey="top" name="Tạ nặng nhất" stroke="currentColor" strokeOpacity={0.35} strokeWidth={1} dot={false} />
                </LineChart>
              </ResponsiveContainer></div>
            ) : <p className="muted">Cần ít nhất 2 buổi của bài này để vẽ biểu đồ.</p>}
            <p className="muted">1RM ước tính = mức tạ nâng được 1 lần, tính từ set tốt nhất (kg × (1 + rep/30)).</p>
          </>
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

      <GeminiForm />

      <section>
        <h2>Backup</h2>
        <p className="muted">Dữ liệu chỉ nằm trong máy này. "Lưu vào Drive" ghi đè file calo-gym-backup.json trong Drive của bạn.</p>
        <div className="row">
          <button onClick={doDrive}>Lưu vào Drive</button>
          <button className="ghost" onClick={doRestore}>Khôi phục từ Drive</button>
        </div>
        {driveMsg && <p className="muted">{driveMsg}</p>}
        <div className="row">
          <button className="ghost" onClick={doExport}>Chia sẻ file</button>
          <label className="btn ghost">Nhập backup<input type="file" accept=".json" hidden onChange={doImport} /></label>
        </div>
      </section>
    </>
  )
}
