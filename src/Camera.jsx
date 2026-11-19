import { useEffect, useRef, useState } from 'react'

const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const DIGITAL_MAX = 4

// Camera toàn màn hình kiểu app Camera iPhone: nút chụp giữa, thư viện góc trái, đóng góc phải,
// 1x/2x/3x + chụm 2 ngón để zoom, nút đèn (torch) nếu máy cho phép.
export default function Camera({ onPick, onClose }) {
  const video = useRef(null)
  const track = useRef(null)
  const pinch = useRef(null)
  const [err, setErr] = useState('')
  const [hw, setHw] = useState({ zoom: null, torch: false }) // khả năng camera thật
  const [zoom, setZoom] = useState(1)
  const [torch, setTorch] = useState(false)

  useEffect(() => {
    let stream
    let stopped = false
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop())
        stream = s
        video.current.srcObject = s
        track.current = s.getVideoTracks()[0]
        const caps = track.current.getCapabilities?.() ?? {}
        setHw({ zoom: caps.zoom?.max > caps.zoom?.min ? caps.zoom : null, torch: !!caps.torch })
      })
      .catch(() => setErr('Không mở được camera. Cho phép camera trong Cài đặt, hoặc chọn ảnh từ thư viện.'))
    return () => { stopped = true; stream?.getTracks().forEach((t) => t.stop()) }
  }, [])

  const min = hw.zoom?.min ?? 1
  const max = hw.zoom?.max ?? DIGITAL_MAX
  const levels = [1, 2, 3].filter((z) => z >= min && z <= max)
  const active = levels.filter((l) => l <= zoom + 0.05).at(-1)

  const applyZoom = (z) => {
    z = clamp(Math.round(z * 10) / 10, min, max)
    setZoom(z)
    if (hw.zoom) track.current?.applyConstraints({ advanced: [{ zoom: z }] }).catch(() => {})
  }

  const toggleTorch = () => {
    const on = !torch
    track.current?.applyConstraints({ advanced: [{ torch: on }] }).then(() => setTorch(on)).catch(() => {})
  }

  // Chụm 2 ngón: tỉ lệ khoảng cách 2 ngón so với lúc bắt đầu.
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
  const onTouchStart = (e) => { if (e.touches.length === 2) pinch.current = { d: dist(e.touches), z: zoom } }
  const onTouchMove = (e) => { if (e.touches.length === 2 && pinch.current) applyZoom(pinch.current.z * (dist(e.touches) / pinch.current.d)) }
  const onTouchEnd = () => { pinch.current = null }

  const shoot = () => {
    const v = video.current
    if (!v?.videoWidth) return
    // Zoom số: cắt phần giữa khung hình. Zoom thật thì khung hình đã zoom sẵn.
    const k = hw.zoom ? 1 : zoom
    const sw = v.videoWidth / k
    const sh = v.videoHeight / k
    const cv = Object.assign(document.createElement('canvas'), { width: Math.round(sw), height: Math.round(sh) })
    cv.getContext('2d').drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, sw, sh)
    cv.toBlob((b) => b && onPick(new File([b], 'chup.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.9)
  }

  const fromLibrary = (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (file) onPick(file)
  }

  return (
    <div className="cam">
      <div className="cam-top">
        {hw.torch && (
          <button className={`cam-icon${torch ? ' on' : ''}`} onClick={toggleTorch} aria-label={torch ? 'Tắt đèn' : 'Bật đèn'} aria-pressed={torch}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
          </button>
        )}
      </div>
      <div className="cam-view" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <video ref={video} autoPlay playsInline muted style={hw.zoom ? undefined : { transform: `scale(${zoom})` }} />
        {err && <p className="cam-err">{err}</p>}
      </div>
      {!err && (
        <div className="cam-zoom">
          {levels.map((z) => (
            // Như iPhone: nút gần nhất bên dưới mức zoom hiện tại sáng lên và hiện số zoom thật (vd 2.4x).
            <button key={z} className={z === active ? 'on' : ''} onClick={() => applyZoom(z)} aria-label={`Zoom ${z}x`}>
              {z === active ? `${zoom}x` : z}
            </button>
          ))}
        </div>
      )}
      <div className="cam-bar">
        <label className="cam-side" aria-label="Chọn ảnh từ thư viện">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></svg>
          <input type="file" accept="image/*" hidden onChange={fromLibrary} />
        </label>
        <button className="cam-shutter" onClick={shoot} disabled={!!err} aria-label="Chụp" />
        <button className="cam-side" onClick={onClose} aria-label="Đóng">✕</button>
      </div>
    </div>
  )
}
