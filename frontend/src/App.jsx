import React from 'react'
import { useApp } from './store/AppContext'
import Login from './components/Login'
import Toast from './components/Toast'
import Header from './components/Header'
import KrishnaMode from './components/KrishnaMode'
import ChakraFAB from './components/ChakraFAB'
import FabOverlay from './components/modals/FabOverlay'
import SmartFetchModal from './components/modals/SmartFetchModal'
import OcrModal from './components/modals/OcrModal'
import SaarthiModal from './components/modals/SaarthiModal'
import ExportModal from './components/modals/ExportModal'
import CalendarModal from './components/modals/CalendarModal'
import KeywordManagerModal from './components/modals/KeywordManagerModal'
import TaskDetailModal from './components/modals/TaskDetailModal'
import DhairyaModal from './components/modals/DhairyaModal'
import TodayBattery from './tabs/TodayBattery'
import Gather from './tabs/Gather'
import Time from './tabs/Time'
import Karma from './tabs/Karma'
import Gita from './tabs/Gita'
import Soul from './tabs/Soul'
import BrainTwin from './tabs/BrainTwin'
import Data from './tabs/Data'
import Score from './tabs/Score'

const TAB_MAP = {
  today:  TodayBattery,
  gather: Gather,
  time:   Time,
  karma:  Karma,
  gita:   Gita,
  soul:   Soul,
  bt:     BrainTwin,
  data:   Data,
  score:  Score,
}

export default function App() {
  const { state, dispatch, doLogout, doImport, showToast, commitTasks } = useApp()
  const { user, loading, activeTab, fabOverlayOpen, smartFetchOpen, saarthiOpen, exportJson, calModal, calAskTask, ocrLines, kwmOpen, leisure, pendingGather } = state

  // Backup: download the file, then offer Notes / WhatsApp / iMessage / Email.
  function handleExport() {
    const now = new Date()
    const dd = String(now.getDate()).padStart(2, '0')
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const yy = String(now.getFullYear()).slice(-2)
    const filename = `KarmaKshetra_Backup_${mm}${dd}${yy}.json`
    const json = JSON.stringify({ exportedAt: now.toISOString(), version: 37, taskCount: state.tasks.length, tasks: state.tasks }, null, 2)
    try {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {}
    dispatch({ type: 'SET_EXPORT', payload: json })
  }

  function handleImportFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result)
        const tasks = Array.isArray(data) ? data : data.tasks || []
        await doImport(tasks)
        showToast(`Imported ${tasks.length} tasks`, 'ok')
      } catch {
        showToast('Invalid backup file', 'error')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  if (!user) return <Login />

  if (loading) return (
    <div className="loader-wrap">
      <div className="loader-ring" />
    </div>
  )

  const TabComponent = TAB_MAP[activeTab] || TodayBattery

  function handleCalAskConfirm() {
    if (!calAskTask) return
    dispatch({ type: 'SET_CAL_MODAL', payload: { open: true, taskTitle: calAskTask.title, task: calAskTask } })
    dispatch({ type: 'SET_CAL_ASK', payload: null })
  }

  // Deadline-or-leisure prompt (Rule 1/4/7).
  function endLeisure() { dispatch({ type: 'SET_LEISURE', payload: { leisure: null, pending: null } }) }
  function leisureDeadline() {
    const p = pendingGather
    endLeisure()
    // Commit with no horizon; the calendar prompt follows for a single task.
    if (p) commitTasks(p.lines, p.useW, p.useMT, null, p.useLA, false)
  }
  function leisureConfirm() {
    const p = pendingGather
    endLeisure()
    if (p) commitTasks(p.lines, p.useW, p.useMT, null, p.useLA, true)
  }

  function handleLogout() {
    if (window.confirm('Log out of Chakra?')) doLogout()
  }

  const showOcrModal = saarthiOpen && ocrLines && ocrLines.length > 0
  const showSaarthiModal = saarthiOpen && (!ocrLines || ocrLines.length === 0)

  return (
    <div id="app" className={[state.krishnaMode ? 'krishna-mode' : '', fabOverlayOpen ? 'fab-open' : ''].filter(Boolean).join(' ')}>
      <div className="user-badge" onClick={handleLogout}>
        👤 {user?.displayName || user?.userId || 'DK'} · Log out
      </div>
      <Header onExport={handleExport} onImportFile={handleImportFile} />
      <div id="content">
        <TabComponent />
      </div>
      <KrishnaMode />
      <ChakraFAB />
      <Toast />

      {fabOverlayOpen && <FabOverlay />}
      {smartFetchOpen && <SmartFetchModal />}
      {kwmOpen && <KeywordManagerModal />}
      {showOcrModal && (
        <OcrModal
          lines={ocrLines}
          onClose={() => {
            dispatch({ type: 'TOGGLE_SAARTHI' })
            dispatch({ type: 'SET_OCR_LINES', payload: [] })
          }}
          onCommit={async selected => {
            dispatch({ type: 'TOGGLE_SAARTHI' })
            dispatch({ type: 'SET_OCR_LINES', payload: [] })
            await commitTasks(selected, 'W2', null, 'thisWeek', null, false)
          }}
        />
      )}
      {showSaarthiModal && <SaarthiModal />}
      {exportJson && <ExportModal jsonStr={exportJson} onClose={() => dispatch({ type: 'SET_EXPORT', payload: null })} />}
      {calModal?.open && (
        <CalendarModal
          task={calModal.task}
          onClose={() => dispatch({ type: 'SET_CAL_MODAL', payload: null })}
        />
      )}
      <TaskDetailModal />
      <DhairyaModal />

      {calAskTask && (
        <div className="cal-ask-toast show">
          <div className="cal-ask-txt">✓ Saved — Add to Calendar?</div>
          <div className="cal-ask-btns">
            <button className="cal-btn go" onClick={handleCalAskConfirm}>Yes — Schedule It</button>
            <button className="cal-btn cancel" onClick={() => dispatch({ type: 'SET_CAL_ASK', payload: null })}>Not now</button>
          </div>
        </div>
      )}

      {leisure === 'ask' && (
        <div className="cal-ask-toast show">
          <div className="cal-ask-txt">Does this have a deadline, or can it be done at leisure?</div>
          <div className="cal-ask-btns">
            <button className="cal-btn go" onClick={leisureDeadline}>Deadline — pick date &amp; time</button>
            <button className="cal-btn cancel" onClick={() => dispatch({ type: 'SET_LEISURE', payload: { leisure: 'warn' } })}>Leisure — no rush</button>
          </div>
        </div>
      )}
      {leisure === 'warn' && (
        <div className="cal-ask-toast show" style={{ background: '#5A5A7A' }}>
          <div className="cal-ask-txt" style={{ color: '#fff' }}>This goes into Vishram — conscious rest, no deadline. You'll pick it up when you have spare time.</div>
          <div className="cal-ask-btns">
            <button className="cal-btn go" onClick={leisureConfirm}>OK — send to Vishram</button>
            <button className="cal-btn cancel" onClick={() => dispatch({ type: 'SET_LEISURE', payload: { leisure: 'ask' } })}>Wait, it has a deadline</button>
          </div>
        </div>
      )}
    </div>
  )
}
