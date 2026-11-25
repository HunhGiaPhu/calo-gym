// Nhận diện món từ ảnh bằng Gemini API, gọi thẳng từ trình duyệt bằng key của người dùng.
// shortcut: key nằm trong localStorage của máy, chỉ hợp app cá nhân; app nhiều người thì phải qua server.

const KEY = 'geminiKey'
const MODEL = 'geminiModel'
// Bản lite trả lời ~10s; gemini-flash-latest hay quá tải, treo >60s làm Safari báo "Load failed".
export const DEFAULT_MODEL = 'gemini-flash-lite-latest'

const read = (k) => { try { return localStorage.getItem(k) || '' } catch { return '' } }
const write = (k, v) => {
  try {
    if (v) localStorage.setItem(k, v)
    else localStorage.removeItem(k)
  } catch { /* private mode */ }
}
export const getKey = () => read(KEY)
export const setKey = (v) => write(KEY, v.trim())
export const getModel = () => read(MODEL) || DEFAULT_MODEL
export const setModel = (v) => write(MODEL, v.trim())

const PROMPT = `Ảnh là bữa ăn của một người Việt đang giảm mỡ tăng cơ.
Liệt kê từng món/thành phần nhìn thấy, ước lượng khối lượng ăn được (gram) và dinh dưỡng CHO ĐÚNG LƯỢNG ĐÓ:
kcal, p (protein g), c (carb g), f (fat g), s (đường g, sugars; nhãn ghi "đường"/"sugars"). Tên món bằng tiếng Việt, ngắn gọn (vd "Cơm trắng", "Ức gà luộc").
Không thấy đồ ăn thì trả items rỗng.`

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' }, grams: { type: 'NUMBER' },
          kcal: { type: 'NUMBER' }, p: { type: 'NUMBER' }, c: { type: 'NUMBER' }, f: { type: 'NUMBER' }, s: { type: 'NUMBER' },
        },
        required: ['name', 'grams', 'kcal', 'p', 'c', 'f', 's'],
      },
    },
  },
  required: ['items'],
}

// Dữ liệu từ AI là dữ liệu ngoài: lọc kỹ, đổi về "trên 100g" để người dùng sửa gram thì số tự tính lại.
export function parseItems(text) {
  let data
  try { data = JSON.parse(text) } catch { throw new Error('Gemini trả về không đọc được') }
  const n = (x) => (Number.isFinite(+x) && +x > 0 ? +x : 0)
  return (Array.isArray(data?.items) ? data.items : [])
    .filter((it) => typeof it?.name === 'string' && it.name.trim() && n(it.grams) > 0)
    .slice(0, 15)
    .map((it) => {
      const g = n(it.grams)
      const per = (x) => Math.round((n(x) / g) * 1000) / 10
      return { name: it.name.trim().slice(0, 60), grams: Math.round(g), kcal: per(it.kcal), p: per(it.p), c: per(it.c), f: per(it.f), s: per(it.s) }
    })
}

// Thu nhỏ ảnh về cạnh dài 1024px: gửi nhanh hơn, tốn ít quota hơn.
// createImageBitmap hay lỗi với ảnh thư viện trên iPhone: lỗi thì giải mã bằng <img>.
async function decode(file) {
  try {
    return await createImageBitmap(file)
  } catch {
    const img = new Image()
    img.src = URL.createObjectURL(file)
    try { await img.decode() } finally { URL.revokeObjectURL(img.src) }
    return img
  }
}

async function toJpegBase64(file, max = 1024) {
  const bmp = await decode(file)
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const cv = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * s), height: Math.round(bmp.height * s) })
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height)
  return cv.toDataURL('image/jpeg', 0.8).split(',')[1]
}

// Ảnh nhãn dinh dưỡng trên bao bì: đọc đúng số in trên nhãn thay vì ước lượng.
export const LABEL_PROMPT = `Ảnh là nhãn dinh dưỡng (Nutrition Facts / Thông tin dinh dưỡng) của một sản phẩm đóng gói.
ĐỌC ĐÚNG số in trên nhãn, không ước lượng. Trả về đúng 1 item:
name = tên sản phẩm ngắn gọn (giữ tên thương hiệu nếu thấy, phần mô tả bằng tiếng Việt);
grams = khối lượng 1 khẩu phần theo nhãn (nhãn chỉ ghi "trên 100g/100ml" thì grams = 100; ml coi như gram);
kcal, p (protein g), c (carb g), f (fat g), s (đường g, sugars; nhãn ghi "đường"/"sugars", nhãn không ghi đường thì s = 0) cho ĐÚNG khẩu phần đó (nhãn ghi kJ thì đổi sang kcal: chia 4.184).
Không thấy nhãn dinh dưỡng hoặc không đọc được số thì trả items rỗng.`

// Nhắn chữ thay cho ảnh: người dùng tự kể món đã ăn.
export const textPrompt = (desc) => `Người Việt đang giảm mỡ tăng cơ kể món đã ăn: "${desc.trim().slice(0, 300)}".
Tách từng món/thành phần, ước lượng khối lượng ăn được (gram; không nói rõ thì lấy khẩu phần Việt Nam thường gặp, vd 1 chén cơm ~150g, 1 quả trứng ~50g)
và dinh dưỡng CHO ĐÚNG LƯỢNG ĐÓ: kcal, p (protein g), c (carb g), f (fat g), s (đường g, sugars; nhãn ghi "đường"/"sugars"). Tên món bằng tiếng Việt, ngắn gọn. Không phải đồ ăn thì trả items rỗng.`

// Người dùng sửa: gửi lại ảnh/lời kể + danh sách lần trước + lời sửa, AI làm lại cả danh sách.
export const fixPrompt = (prev, note, base = PROMPT) => `${base}
Lần trước bạn nhận ra (tên, gram): ${JSON.stringify(prev.map((it) => [it.name, +it.grams || 0]))}.
Người dùng sửa lại: "${note.trim().slice(0, 300)}".
Làm lại danh sách theo lời sửa (đổi món, thêm, bớt, đổi gram nếu được nói). Món không bị nhắc thì giữ nguyên tên và gram.`

// input: File (ảnh) hoặc chuỗi (lời kể). fix = { prev, note } khi người dùng gõ lời sửa. mode 'label' = ảnh nhãn dinh dưỡng.
export async function recognize(input, fix, mode) {
  const key = getKey()
  if (!key) throw new Error('Chưa có API key. Nhập ở tab Tiến độ.')
  // Báo rõ hỏng ở bước nào (đọc ảnh hay gửi đi), vì Safari chỉ báo chung chung "Load failed".
  const desc = typeof input === 'string' ? input : null
  let data = ''
  if (!desc) {
    try { data = await toJpegBase64(input) } catch (e) { throw new Error(`Không đọc được ảnh (${e.name}: ${e.message})`) }
  }
  const base = desc ? textPrompt(desc) : mode === 'label' ? LABEL_PROMPT : PROMPT
  const prompt = fix ? fixPrompt(fix.prev, fix.note, base) : base
  // Model đã chọn quá tải hoặc chậm quá 30s (Safari tự cắt ở ~60s) thì thử lại bằng model mặc định.
  const models = [...new Set([getModel(), DEFAULT_MODEL])]
  let res
  for (const [i, model] of models.entries()) {
    const last = i === models.length - 1
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 30000)
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        signal: ctl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [...(data ? [{ inline_data: { mime_type: 'image/jpeg', data } }] : []), { text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA },
        }),
      })
    } catch (e) {
      if (!last && e.name === 'AbortError') continue
      throw new Error(e.name === 'AbortError'
        ? 'Gemini không trả lời sau 30 giây (đang quá tải), thử lại sau.'
        : `Không gửi được tới Gemini (${e.name}: ${e.message}).${data ? ` Ảnh ${Math.round(data.length / 1024)}KB.` : ''}`)
    } finally {
      clearTimeout(timer)
    }
    if (last || ![429, 500, 503].includes(res.status)) break
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.error?.message || `Lỗi ${res.status}`)
  const text = (body.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('')
  return parseItems(text)
}
