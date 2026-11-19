import { useEffect, useState } from 'react'

// Bíp lên lịch sẵn bằng Web Audio ngay lúc bấm (cần thao tác tay thì iPhone mới cho phát tiếng).
function scheduleBeep(sec) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    for (const t of [0, 0.25, 0.5]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      gain.gain.value = 0.25
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + sec + t)
      osc.stop(ctx.currentTime + sec + t + 0.15)
    }
    return ctx
  } catch {
    return null
  }
}

export function useRest() {
  const [rest, setRest] = useState(null) // { end, ctx }
  const start = (sec) => {
    rest?.ctx?.close()
    setRest({ end: Date.now() + sec * 1000, ctx: scheduleBeep(sec) })
  }
  const stop = () => { rest?.ctx?.close(); setRest(null) }
  return { rest, start, stop }
}

// Tính theo mốc giờ kết thúc nên khoá màn hình rồi mở lại vẫn đúng.
export default function RestTimer({ rest, onStop, onAdd }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])
  const left = Math.ceil((rest.end - now) / 1000)
  useEffect(() => {
    if (left > -5) return
    onStop() // hết giờ được 5 giây thì tự ẩn
  }, [left, onStop])
  const done = left <= 0
  const mm = Math.floor(Math.max(0, left) / 60)
  const ss = String(Math.max(0, left) % 60).padStart(2, '0')
  return (
    <div className={`rest${done ? ' done' : ''}`} role="timer" aria-live="polite">
      <span>{done ? 'Hết giờ nghỉ, vào set!' : `Nghỉ ${mm}:${ss}`}</span>
      {!done && <button className="ghost" onClick={() => onAdd(15)}>+15s</button>}
      <button className="x" onClick={onStop} aria-label="Tắt đồng hồ nghỉ">✕</button>
    </div>
  )
}
