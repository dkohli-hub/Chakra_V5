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
import TodayBattery from './tabs/TodayBattery'
import Gather from './tabs/Gather'
import Time from './tabs/Time'
import Karma from './tabs/Karma'
import Gita from './tabs/Gita'
import Soul from './tabs/Soul'
import BrainTwin from './tabs/BrainTwin'
import Data from './tabs/Data'
import Score from './tabs/Score'
import { createTask, normaliseTask } from './api'

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
  const { state, dispatch, doLogout, doImport, showToast } = useApp()
  const { user, loading, activeTab, fabOverlayOpen, smartFetchOpen, saarthiOpen, exportOpen, calModal, calAskTask, ocrLines } = state

  function handleExport() {
    const json = JSON.stringify(state.tasks, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chakra-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
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

  const showOcrModal = saarthiOpen && ocrLines && ocrLines.length > 0
  const showSaarthiModal = saarthiOpen && (!ocrLines || ocrLines.length === 0)

  return (
    <div id="app" className={state.krishnaMode ? 'krishna-mode' : ''}>
      <Header onExport={handleExport} onImportFile={handleImportFile} />
      <div id="content">
        <TabComponent />
      </div>
      <KrishnaMode />
      <ChakraFAB />
      <Toast />

      {fabOverlayOpen && <FabOverlay />}
      {smartFetchOpen && <SmartFetchModal />}
      {showOcrModal && (
        <OcrModal
          lines={ocrLines}
          onClose={() => {
            dispatch({ type: 'TOGGLE_SAARTHI' })
            dispatch({ type: 'SET_OCR_LINES', payload: [] })
          }}
          onCommit={async selected => {
            for (const title of selected) {
              try {
                const raw = await createTask({ title, bucket: 'Karya', weightage: 'W2', time_horizon: 'today' })
                dispatch({ type: 'ADD_TASK', payload: normaliseTask(raw) })
              } catch {}
            }
            dispatch({ type: 'TOGGLE_SAARTHI' })
            dispatch({ type: 'SET_OCR_LINES', payload: [] })
            dispatch({ type: 'SHOW_TOAST', payload: { msg: `${selected.length} task(s) added`, type: 'ok' } })
          }}
        />
      )}
      {showSaarthiModal && <SaarthiModal />}
      {exportOpen && <ExportModal />}
      {calModal?.open && (
        <CalendarModal
          task={calModal.task}
          onClose={() => dispatch({ type: 'SET_CAL_MODAL', payload: null })}
        />
      )}

      {calAskTask && (
        <div className="cal-ask-toast show">
          <div className="cal-ask-txt">✓ Saved — Add to Calendar?</div>
          <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: '11px', color: 'var(--text-faint)', marginBottom: '8px' }}>
            "{calAskTask.title}"
          </div>
          <div className="cal-ask-btns">
            <button className="cal-btn go" onClick={handleCalAskConfirm}>Yes — Schedule It</button>
            <button className="cal-btn cancel" onClick={() => dispatch({ type: 'SET_CAL_ASK', payload: null })}>Not now</button>
          </div>
        </div>
      )}
    </div>
  )
}
