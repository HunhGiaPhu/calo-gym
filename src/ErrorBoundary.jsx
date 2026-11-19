import { Component } from 'react'

// Một tab lỗi thì hiện lỗi ra, không làm đen cả app.
export default class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <section>
        <h2>Tab này bị lỗi</h2>
        <p>Chụp màn hình này gửi lại để sửa:</p>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '.75rem' }}>
          {String(error?.stack || error).slice(0, 1200)}{'\n\n'}{navigator.userAgent}
        </pre>
        <button onClick={() => this.props.onReset?.()}>Về Hôm nay</button>
      </section>
    )
  }
}
