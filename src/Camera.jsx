import { useEffect, useRef, useState } from 'react'

// Camera toàn màn hình kiểu app Camera iPhone: nút chụp giữa, thư viện góc trái, đóng góc phải.
export default function Camera({ onPick, onClose }) {
  const video = useRef(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let stream
    let stopped = false
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop())
        stream = s
        video.current.srcObject = s
      })
      .catch(() => setErr('Không mở được camera. Cho phép camera trong Cài đặt, hoặc chọn ảnh từ thư viện.'))
    return () => { stopped = true; stream?.getTracks().forEach((t) => t.stop()) }
  }, [])

  const shoot = () => {
    const v = video.current
    if (!v?.videoWidth) return
    const cv = Object.assign(document.createElement('canvas'), { width: v.videoWidth, height: v.videoHeight })
    cv.getContext('2d').drawImage(v, 0, 0)
    cv.toBlob((b) => b && onPick(new File([b], 'chup.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.9)
  }

  const fromLibrary = (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (file) onPick(file)
  }

  return (
    <div className="cam">
      <video ref={video} autoPlay playsInline muted />
      {err && <p className="cam-err">{err}</p>}
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
