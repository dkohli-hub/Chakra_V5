import React, { useRef } from 'react'
import { useApp } from '../../store/AppContext'

export default function ExportModal({ jsonStr, filename, onClose }) {
  const { state, showToast } = useApp()
  const taRef = useRef(null)

  if (!jsonStr) return null

  function copy() {
    if (taRef.current) {
      taRef.current.select()
      try {
        document.execCommand('copy')
        showToast('✓ Copied — paste into Notes, WhatsApp, or email', 'ok', 3500)
      } catch {
        showToast('Long-press the text above → Select All → Copy', 'warn', 3500)
      }
    }
  }

  function shareNotes() {
    copy()
    onClose()
    showToast('✓ JSON copied — Notes is opening → tap + New Note → Paste', 'ok', 5000)
    setTimeout(() => { window.location.href = 'mobilenotes://' }, 300)
  }

  function shareWhatsApp() {
    const active = state.tasks.filter(t => !t.completed)
    const lines = [`📋 Karma Kshetra Backup — ${new Date().toLocaleDateString()} — ${state.tasks.length} tasks\n`]
    active.slice(0, 40).forEach((t, i) => lines.push(`${i+1}. [${t.bucket}] ${t.title}`))
    if (active.length > 40) lines.push(`... and ${active.length - 40} more tasks`)
    const encoded = encodeURIComponent(lines.join('\n'))
    onClose()
    window.location.href = `whatsapp://send?text=${encoded}`
    setTimeout(() => showToast('If WhatsApp did not open, use Email or Notes instead', 'warn', 4000), 2000)
  }

  function shareSMS() {
    const summary = `Karma Kshetra Backup ${new Date().toLocaleDateString()} — ${state.tasks.length} tasks: `
      + state.tasks.filter(t => !t.completed).slice(0, 10).map(t => t.title).join(', ')
      + (state.tasks.length > 10 ? '...' : '')
    onClose()
    window.open(`sms:&body=${encodeURIComponent(summary)}`, '_blank')
  }

  function shareEmail() {
    const subject = encodeURIComponent(`Karma Kshetra Backup — ${new Date().toLocaleDateString()} — ${state.tasks.length} tasks`)
    const body = encodeURIComponent(
      `Karma Kshetra Task Backup\nDate: ${new Date().toLocaleString()}\nTasks: ${state.tasks.length}\n\nFULL JSON BACKUP:\n\n${jsonStr}`
    )
    onClose()
    window.location.href = `mailto:dh.kohli@gmail.com?subject=${subject}&body=${body}`
  }

  return (
    <div className="exp-modal" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="exp-box">
        <div className="exp-title">📋 Backup ({state.tasks.length} tasks)</div>
        <div className="exp-sub">
          Choose where to save. <strong>Email</strong> sends the full JSON to yourself.
          <strong>Notes</strong> copies JSON and opens the Notes app.
        </div>
        <div className="exp-share-grid">
          <button className="exp-share-btn" onClick={shareNotes}>
            <span className="exp-share-icon">📝</span><span>Notes</span>
          </button>
          <button className="exp-share-btn" onClick={shareWhatsApp}>
            <span className="exp-share-icon">💬</span><span>WhatsApp</span>
          </button>
          <button className="exp-share-btn" onClick={shareSMS}>
            <span className="exp-share-icon">✉️</span><span>iMessage</span>
          </button>
          <button className="exp-share-btn" onClick={shareEmail}>
            <span className="exp-share-icon">📧</span><span>Email</span>
          </button>
        </div>
        <div className="exp-sub" style={{ marginTop: '2px' }}>Or copy the raw JSON to paste anywhere:</div>
        <textarea ref={taRef} className="exp-textarea" readOnly value={jsonStr} />
        <div className="exp-btn-row">
          <button className="exp-btn secondary" onClick={onClose}>Close</button>
          <button className="exp-btn primary" onClick={copy}>📋 Copy JSON</button>
        </div>
      </div>
    </div>
  )
}
