import React from 'react'
import { useApp } from '../store/AppContext'
import { TABS } from '../constants'

export default function Header({ onExport, onImportFile }) {
  const { state, dispatch, doClearCompleted, showToast } = useApp()
  const { tasks, activeTab, user, syncStatus } = state

  const active = tasks.filter(t => !t.completed).length
  const done = tasks.length - active

  function switchTab(id) {
    dispatch({ type: 'SET_TAB', payload: id })
  }

  async function handleClearDone() {
    const doneCount = tasks.filter(t => t.completed).length
    if (!doneCount) { showToast('No completed tasks to clear', 'warn'); return }
    if (!window.confirm(`Remove ${doneCount} completed task${doneCount === 1 ? '' : 's'} permanently?`)) return
    try {
      await doClearCompleted()
      showToast(`✓ Cleared ${doneCount} completed tasks`)
    } catch {
      showToast('Failed to clear completed', 'warn')
    }
  }

  return (
    <div className="hdr">
      <div className="hdr-row">
        <div>
          <div className="brand">Chakra</div>
          <div className="page-title">Karma Kshetra™</div>
          <div className="page-sub">
            Version 5 &nbsp;·&nbsp; Your mind, structured. &nbsp;·&nbsp;
            <span style={{ fontSize: '9px', color: 'var(--teal2)' }}>{syncStatus}</span>
          </div>
        </div>
        <div className="hdr-stats">
          <div className="stat-row">
            <span className="stat-pill" style={{ color: 'var(--gold)', borderColor: 'rgba(160,120,40,.3)', background: 'rgba(160,120,40,.08)' }}>
              {active} active
            </span>
            <span className="stat-pill" style={{ color: 'var(--teal2)', borderColor: 'rgba(26,128,96,.3)', background: 'rgba(26,128,96,.06)' }}>
              {done} done
            </span>
          </div>
        </div>
      </div>
      <div className="tab-bar">
        {TABS.map(t => (
          <div
            key={t.id}
            className={`vtab${t.id === activeTab ? ' active' : ''}`}
            onClick={() => switchTab(t.id)}
          >
            <span className="ti">{t.icon}</span>
            {t.label}
          </div>
        ))}
      </div>
      <div className="data-btn-row">
        <button className="data-btn export" onClick={onExport}>⬇ Backup JSON</button>
        <label className="data-btn import">
          ⬆ Restore JSON
          <input type="file" accept=".json" style={{ display: 'none' }} onChange={onImportFile} />
        </label>
        <button className="data-btn danger" onClick={handleClearDone}>✕ Clear completed</button>
      </div>
    </div>
  )
}
