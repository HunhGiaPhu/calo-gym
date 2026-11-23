import { exportAll, importAll, setSetting } from './db'

// Backup thẳng lên Google Drive bằng Google Identity Services (token client, không cần server).
// Client ID không phải bí mật: Google chỉ cho dùng từ origin đã khai báo (hunhgiaphu.github.io).
const CLIENT_ID = '708462321380-8f3cr69htphqfpefiaa166i6imh211i3.apps.googleusercontent.com'
const SCOPE = 'https://www.googleapis.com/auth/drive.file' // chỉ thấy file do app tạo
const NAME = 'calo-gym-backup.json'

let loading = null
export function loadGis() {
  loading ??= new Promise((ok, bad) => {
    if (window.google?.accounts?.oauth2) return ok()
    const s = Object.assign(document.createElement('script'), { src: 'https://accounts.google.com/gsi/client', async: true })
    s.onload = ok
    s.onerror = () => { loading = null; bad(new Error('Không tải được Google (mất mạng?)')) }
    document.head.appendChild(s)
  })
  return loading
}

let token = null
let tokenExp = 0

// Gọi NGAY trong lúc bấm nút (không await gì trước), không thì iPhone chặn cửa sổ đăng nhập.
export function getToken() {
  if (token && Date.now() < tokenExp) return Promise.resolve(token)
  if (!window.google?.accounts?.oauth2) return Promise.reject(new Error('Google chưa tải xong, thử lại sau vài giây'))
  return new Promise((ok, bad) => {
    window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (r) => {
        if (r.error) return bad(new Error(r.error_description || r.error))
        token = r.access_token
        tokenExp = Date.now() + (r.expires_in - 60) * 1000
        ok(token)
      },
      error_callback: (e) => bad(new Error(e.type === 'popup_closed' ? 'Đã đóng cửa sổ Google' : e.message || e.type)),
    }).requestAccessToken({ prompt: '' })
  })
}

async function api(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...opts.headers } })
  if (!r.ok) {
    if (r.status === 401) token = null // hết hạn: lần bấm sau xin lại
    const b = await r.json().catch(() => ({}))
    throw new Error(b?.error?.message || `Drive lỗi ${r.status}`)
  }
  return r.json()
}

// File backup app đã tạo (scope drive.file chỉ thấy file của app). Lỡ có 2 file trùng tên thì lấy bản mới nhất.
async function findBackup() {
  const q = encodeURIComponent(`name='${NAME}' and trashed=false`)
  const { files } = await api(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,modifiedTime)&orderBy=modifiedTime%20desc&spaces=drive`)
  return files?.[0]
}

// Ghi đè 1 file cố định. Drive tự giữ lịch sử phiên bản cũ ~30 ngày.
export async function uploadBackup(json) {
  const id = (await findBackup())?.id
  if (id) {
    return api(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: json,
    })
  }
  const b = `calogym${Date.now()}`
  const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: NAME, mimeType: 'application/json' })}\r\n`
    + `--${b}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${b}--`
  return api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${b}` }, body,
  })
}

// Gọi NGAY trong lúc bấm nút (getToken chạy trước mọi await), dùng chung cho tab Hôm nay và Tiến độ.
export const backupToDrive = () => getToken().then(async () => {
  await uploadBackup(JSON.stringify(await exportAll()))
  await setSetting('lastBackup', Date.now())
})

// Tải bản backup trên Drive về, hỏi lại (ask nhận dữ liệu + ngày lưu để báo bản cũ hay mới) rồi mới thay toàn bộ dữ liệu.
// importAll kiểm file trước khi xoá dữ liệu cũ. Cũng phải gọi ngay lúc bấm nút như backupToDrive.
export const restoreFromDrive = (ask) => getToken().then(async () => {
  const file = await findBackup()
  if (!file) throw new Error('Chưa có file backup trên Drive')
  const data = await api(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`)
  const savedAt = new Date(file.modifiedTime || Date.now())
  if (!ask(data, savedAt)) return false
  await importAll(data)
  await setSetting('lastBackup', savedAt.getTime()) // file mang ngày backup lần trước nữa, đặt lại cho đúng bản vừa lấy
  return true
})
