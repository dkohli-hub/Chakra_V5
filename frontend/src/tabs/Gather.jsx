import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/AppContext'
import TaskCard from '../components/TaskCard'
import Footer from '../components/Footer'
import { scanOCR } from '../api'
import { parseWeightage, parseMultitask, parseHorizon } from '../utils'

const WEIGHTS = ['W1', 'W2', 'W3', 'W4', 'W5']
const W_SHORT = ['5m', '30m', '1h', '½d', 'Day']
const HORIZONS = [['today','Today'],['thisWeek','This week'],['nextWeek','Next week'],['thisMonth','Next month'],['Q3','Q3 2026'],['thisYear','This year'],['1year','1–2 years'],['parkingLot','Parking lot']]
const LIFE_AREAS = [['Personal/Family','Personal'],['Work/Employment','Work'],['Picturizze','Picturizze'],['Other','Other']]

function Chips({ options, value, onPick }) {
  return (
    <div className="tag-opts">
      {options.map(([v, l]) => (
        <span key={v} className={`tag-chip${value === v ? ' sel' : ''}`} onClick={() => onPick(v)}>{l}</span>
      ))}
    </div>
  )
}

export default function Gather() {
  const { state, dispatch, commitTasks, showToast } = useApp()
  const fileRef = useRef()
  const awaitingLeisure = useRef(false)
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const [w, setW] = useState(null)
  const [th, setTh] = useState(null)
  const [la, setLa] = useState(null)
  const [mt, setMt] = useState(null)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [preview, setPreview] = useState(null)
  const [scanning, setScanning] = useState(false)

  const active = state.tasks.filter(t => !t.completed)
  const recent = active.slice(-6).reverse()

  function resetForm() {
    setText(''); setNote(''); setW(null); setTh(null); setLa(null); setMt(null)
    setTagsOpen(false); clearImg()
  }

  // The deadline-or-leisure prompt lives in App; clear the form once it resolves.
  useEffect(() => {
    if (awaitingLeisure.current && state.leisure === null) {
      awaitingLeisure.current = false
      resetForm()
    }
  }, [state.leisure])

  function clearImg() {
    setPreview(null)
    setScanning(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleImg(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setScanning(true)
    const reader = new FileReader()
    reader.onload = ev => {
      const image = new Image()
      image.onload = async () => {
        try {
          const mW = 1200
          const scale = image.width > mW ? mW / image.width : 1
          const cv = document.createElement('canvas')
          cv.width = Math.round(image.width * scale)
          cv.height = Math.round(image.height * scale)
          cv.getContext('2d').drawImage(image, 0, 0, cv.width, cv.height)
          const compressed = cv.toDataURL('image/jpeg', 0.85)
          setPreview(compressed)
          const scanned = (await scanOCR(compressed.split(',')[1]) || '').trim()
          setScanning(false)
          if (!scanned) { showToast('No text found in image — try a clearer photo.', 'warn', 3500); return }
          const lines = scanned.split('\n').map(l => l.trim()).filter(Boolean)
          dispatch({ type: 'SET_OCR_LINES', payload: lines })
          dispatch({ type: 'TOGGLE_SAARTHI' })
        } catch {
          setScanning(false)
          showToast('OCR failed — check your connection.', 'warn', 3500)
        }
      }
      image.onerror = () => setScanning(false)
      image.src = ev.target.result
    }
    reader.onerror = () => setScanning(false)
    reader.readAsDataURL(file)
  }

  async function gatherSave() {
    const rawText = text.trim()
    if (!rawText) return
    const lines = rawText.split('\n').map(s => s.trim()).filter(Boolean)
    // Metadata comes from tag picks, else from the commentary box (no API).
    const useW = w || parseWeightage(note)
    const useMT = mt ? mt === 'yes' : parseMultitask(note)
    const useTH = th || parseHorizon(note)
    const useLA = la || null
    // Rule 1/4/7: no horizon given → ask deadline-or-leisure before committing.
    if (!useTH) {
      awaitingLeisure.current = true
      dispatch({ type: 'SET_LEISURE', payload: { leisure: 'ask', pending: { lines, useW, useMT, useLA } } })
      return
    }
    resetForm()
    await commitTasks(lines, useW, useMT, useTH, useLA, false)
  }

  return (
    <div className="gather-wrap">
      <div className="gather-card">
        <div className="gather-prompt">What is the task?</div>
        <textarea
          className="gather-textarea"
          placeholder="One task per line — type or paste from photo"
          rows={3}
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <div className="img-section">
          <div className="img-section-lbl">📷 Upload photo or screenshot</div>
          <label className="img-upload-btn">
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImg} />📷 Choose image
          </label>
          <div className="img-preview-row">
            <img className={`img-preview${preview ? ' show' : ''}`} src={preview || undefined} alt="" />
            <div>
              <div className={`img-scanning${scanning ? ' show' : ''}`}>Reading your handwriting…</div>
              <button className={`img-clear${preview ? ' show' : ''}`} onClick={clearImg}>✕ Clear image</button>
            </div>
          </div>
          <textarea
            className="img-commentary"
            placeholder="Context (optional): duration, multitask, urgency..."
            rows={2}
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>
        <div className="tags-toggle" onClick={() => setTagsOpen(o => !o)}>
          <span className="tags-toggle-lbl">Tags &amp; Options</span>
          <span className={`tags-chevron${tagsOpen ? ' open' : ''}`}>▼</span>
        </div>
        <div className={`tags-body${tagsOpen ? ' open' : ''}`}>
          <div className="tag-group">
            <div className="tag-lbl">Weightage</div>
            <Chips options={WEIGHTS.map((x, i) => [x, `${x} · ${W_SHORT[i]}`])} value={w} onPick={setW} />
          </div>
          <div className="tag-group">
            <div className="tag-lbl">Time Horizon</div>
            <Chips options={HORIZONS} value={th} onPick={setTh} />
          </div>
          <div className="tag-group">
            <div className="tag-lbl">Life Area</div>
            <Chips options={LIFE_AREAS} value={la} onPick={setLa} />
          </div>
          <div className="tag-group">
            <div className="tag-lbl">Multitaskable?</div>
            <Chips options={[['yes', 'Yes — driving/walk'], ['no', 'No — full focus']]} value={mt} onPick={setMt} />
          </div>
        </div>
      </div>

      {recent.length > 0 && (
        <>
          <div className="sec-hdr">
            <span className="sec-title">Recent entries</span>
            <span className="sec-count">{active.length} active</span>
          </div>
          {recent.map(t => <TaskCard key={t.id} task={t} />)}
        </>
      )}
      <Footer />

      <button className={`gather-fab${text.trim() ? ' visible' : ''}`} onClick={gatherSave}>Add to Chakra ＋</button>
    </div>
  )
}
