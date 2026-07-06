import React, { useState, useEffect } from 'react'
import { useApp } from '../../store/AppContext'
import { CAL_SLOTS, CAL_KEYWORDS } from '../../constants'
import { suggestCalendar } from '../../utils'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const CAL_INFO = {
  itc: {
    name: 'ITC Calendar (out of Chakra scope — view only)',
    email: import.meta.env.VITE_CAL_ITC || 'dkohli@itconvergence.com',
    icon: '💼',
    outOfScope: true
  },
  personal: {
    name: 'Personal Calendar',
    email: import.meta.env.VITE_CAL_PERSONAL || 'dh.kohli@gmail.com',
    icon: '🏠'
  },
  picturizze: {
    name: 'Picturizze',
    email: import.meta.env.VITE_CAL_PICTURIZZE || 'picturizze@gmail.com',
    icon: '📸'
  }
}

let _gisTokenClient = null
let _googleAccessToken = null

function initGIS(callback) {
  if (_gisTokenClient) return
  if (!window.google?.accounts?.oauth2) return
  _gisTokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
    callback: (resp) => {
      if (resp?.access_token) {
        _googleAccessToken = resp.access_token
        callback && callback(resp.access_token)
      }
    }
  })
}

function slotLabelToDates(slotLabel) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const parts = slotLabel.split(' ')
  const dayAbbr = parts[0]
  const timePart = parts[1] + ' ' + parts[2]
  const targetDow = days.indexOf(dayAbbr)
  const now = new Date()
  const d = new Date(now)
  let add = (targetDow - now.getDay() + 7) % 7
  if (add === 0) add = 7
  d.setDate(now.getDate() + add)
  const m = timePart.match(/(\d+):(\d+)\s*([AP]M)/i)
  let hh = parseInt(m[1], 10)
  const mm = parseInt(m[2], 10)
  const ap = m[3].toUpperCase()
  if (ap === 'PM' && hh !== 12) hh += 12
  if (ap === 'AM' && hh === 12) hh = 0
  d.setHours(hh, mm, 0, 0)
  const start = new Date(d)
  const end = new Date(d.getTime() + 30 * 60000)
  return { start: start.toISOString(), end: end.toISOString() }
}

async function createCalEvent(calendarId, title, slotLabel, token) {
  const dates = slotLabelToDates(slotLabel)
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: title, start: { dateTime: dates.start }, end: { dateTime: dates.end } })
  })
  return r.json()
}

export default function CalendarModal() {
  const { state, dispatch, showToast } = useApp()
  const modal = state.calModal
  const [selCal, setSelCal] = useState('itc')
  const [bookedSlot, setBookedSlot] = useState(null)
  const [confirmDetail, setConfirmDetail] = useState(null)

  useEffect(() => {
    if (modal) {
      const title = modal.taskTitle || modal.task?.title || ''
      const suggested = suggestCalendar(title, CAL_KEYWORDS)
      setSelCal(suggested || 'personal')
      setBookedSlot(null)
      setConfirmDetail(null)
    }
  }, [modal])

  if (!modal) return null

  const taskTitle = modal.taskTitle || modal.task?.title || 'New Task'

  function close() { dispatch({ type: 'SET_CAL_MODAL', payload: null }) }

  function selectCal(id) {
    if (CAL_INFO[id]?.outOfScope) {
      showToast('ITC is out of Chakra scope right now — view only.', 'warn', 3000)
      return
    }
    setSelCal(id)
  }

  function bookSlot(slot) {
    setBookedSlot(slot)
    const cal = CAL_INFO[selCal]
    if (!cal || cal.outOfScope) {
      setConfirmDetail('ITC is out of Chakra scope — view only. Not written to any calendar.')
      showToast('ITC is view only — not scheduled.', 'warn', 3000)
      return
    }
    if (CLIENT_ID && !CLIENT_ID.includes('your-')) {
      setConfirmDetail('Connecting to Google Calendar…')
      initGIS(async (token) => {
        try {
          const result = await createCalEvent(cal.email, taskTitle, slot, token)
          if (result?.htmlLink) {
            setConfirmDetail(`${taskTitle} · ${slot} · ${cal.name}`)
            showToast(`✓ Added to ${cal.name} — ${slot}`, 'ok', 3500)
          } else {
            const msg = result?.error?.message || 'Unknown error'
            setConfirmDetail(`Calendar write failed: ${msg}`)
            showToast(`Calendar write failed: ${msg}`, 'warn', 4000)
          }
        } catch {
          setConfirmDetail('Calendar write failed — check connection.')
          showToast('Calendar write failed — check your connection.', 'warn', 4000)
        }
      })
      if (_gisTokenClient) _gisTokenClient.requestAccessToken()
      return
    }
    setConfirmDetail(`${taskTitle} · ${slot} · ${cal.name} (demo mode — not a real calendar write)`)
    showToast(`✓ Scheduled (demo) — ${slot} · ${cal.name}`, 'ok', 3000)
  }

  return (
    <div className="cal-modal" onClick={e => { if (e.target === e.currentTarget) close() }}>
      <div className="cal-box">
        <div className="cal-title">Schedule It</div>
        <div className="cal-task-lbl">{taskTitle}</div>
        <div className="cal-sub">Chakra suggests a calendar based on your task. Confirm or change.</div>
        <div className="cal-opts">
          {['itc', 'personal', 'picturizze'].map(id => {
            const c = CAL_INFO[id]
            const isSel = id === selCal
            return (
              <div key={id} className={`cal-opt${isSel ? ' sel' : ''}`} onClick={() => selectCal(id)}>
                <span className="cal-opt-icon">{c.icon}</span>
                <div>
                  <div className="cal-opt-name">{c.name}</div>
                  <div className="cal-opt-email">{c.email}</div>
                  {c.outOfScope && <div className="cal-oos-tag">Out of Chakra scope — view only</div>}
                </div>
                {isSel && <div className="cal-sug">✓ Suggested</div>}
              </div>
            )
          })}
        </div>
        <div className="cal-sub" style={{ marginTop: '8px' }}>Available slots — All week</div>
        <div className="cal-slot-grid">
          {CAL_SLOTS.map(s => (
            <div
              key={s}
              className={`cal-slot${bookedSlot === s ? ' booked' : ''}`}
              onClick={() => bookSlot(s)}
            >{s}</div>
          ))}
        </div>
        {confirmDetail && (
          <div className="cal-confirm-box show">
            <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: '11px', fontWeight: 600, color: '#1A6B5A' }}>✓ Added to Calendar</div>
            <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: '11px', color: '#1A6B5A', marginTop: '4px' }}>{confirmDetail}</div>
            <div className="cal-confirm-note">This task stays in Chakra™. Complete it in your calendar, then come back here to close it out.</div>
          </div>
        )}
        <div className="cal-btn-row" style={{ marginTop: '8px' }}>
          <button className="cal-btn cancel" onClick={close}>Done</button>
        </div>
      </div>
    </div>
  )
}
