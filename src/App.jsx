import { useState } from 'react'
import Today from './pages/Today'
import Eat from './pages/Eat'
import Gym from './pages/Gym'
import Progress from './pages/Progress'
import ErrorBoundary from './ErrorBoundary'
import RestTimer, { useRest } from './RestTimer'

// Icon nét đơn giản, vẽ tay để khỏi thêm thư viện icon.
const I = (d) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)
const TABS = [
  ['today', 'Hôm nay', Today, I(<><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></>)],
  ['eat', 'Ăn', Eat, I(<><path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8M15 3c-1.5 2-2 4-2 6s1 3 2 3v9" /></>)],
  ['gym', 'Tập', Gym, I(<><path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" /></>)],
  ['progress', 'Tiến độ', Progress, I(<><path d="M4 19h16M6 15l4-4 3 3 5-6" /></>)],
]

export default function App() {
  const [tab, setTab] = useState('today')
  const { rest, start, stop } = useRest()
  const Page = TABS.find((t) => t[0] === tab)[2]
  return (
    <>
      <main><ErrorBoundary key={tab} onReset={() => setTab('today')}><Page go={setTab} startRest={start} /></ErrorBoundary></main>
      {rest && <RestTimer rest={rest} onStop={stop} onAdd={(s) => start(Math.max(0, (rest.end - Date.now()) / 1000) + s)} />}
      <nav>
        {TABS.map(([id, label, , icon]) => (
          <button key={id} className={tab === id ? 'on' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
            {icon}{label}
          </button>
        ))}
      </nav>
    </>
  )
}
