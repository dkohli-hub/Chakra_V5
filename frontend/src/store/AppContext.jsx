import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react'
import { getTasks, login as apiLogin, createTask, updateTask, clearCompleted as apiClearCompleted, bulkImport as apiBulkImport } from '../api'
import { CAL_KEYWORDS as DEFAULT_KEYWORDS } from '../constants'
import { shortTitleFrom } from '../utils'
import { classifyTask, detectLink } from '../ai'

const AppContext = createContext(null)

function loadPersistedKeywords() {
  try {
    const raw = localStorage.getItem('chakra_cal_keywords')
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

const initialState = {
  tasks: [],
  activeTab: 'today',
  user: null,
  token: null,
  loading: false,
  krishnaMode: false,
  drillKey: null,
  toast: null,
  smartFetchOpen: false,
  saarthiOpen: false,
  calModal: null,       // { taskTitle }
  ocrLines: null,       // string[] | null
  fabOverlayOpen: false,
  exportOpen: false,
  calAskTask: null,     // task title to offer calendar for
  syncStatus: '⟳ loading...',
  kwmOpen: false,
  calKeywords: loadPersistedKeywords() || DEFAULT_KEYWORDS,
  // V9
  detail: null,         // { type: 'task', id } | { type: 'tamas' | 'aq' | 'cq' }
  dhairyaId: null,      // task id for the Dhairya "waiting" menu
  leisure: null,        // null | 'ask' | 'warn'  — deadline-or-leisure prompt
  pendingGather: null,  // { lines, useW, useMT, useLA } held while asking
  exportJson: null,     // backup JSON shown in the share modal
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':   return { ...state, loading: action.payload }
    case 'SET_TASKS':     return { ...state, tasks: action.payload }
    case 'ADD_TASK':      return { ...state, tasks: [...state.tasks, action.payload] }
    case 'UPDATE_TASK':   return { ...state, tasks: state.tasks.map(t => t.id === action.payload.id ? action.payload : t) }
    case 'DELETE_TASK':   return { ...state, tasks: state.tasks.filter(t => t.id !== action.payload) }
    case 'SET_TAB':       return { ...state, activeTab: action.payload, drillKey: null }
    case 'SET_USER':      return { ...state, user: action.payload.user, token: action.payload.token }
    case 'LOGOUT':        return { ...initialState }
    case 'SET_KRISHNA':   return { ...state, krishnaMode: action.payload }
    case 'SET_DRILL':     return { ...state, drillKey: action.payload }
    case 'SHOW_TOAST':    return { ...state, toast: action.payload }
    case 'CLEAR_TOAST':   return { ...state, toast: null }
    case 'TOGGLE_SMART_FETCH': return { ...state, smartFetchOpen: !state.smartFetchOpen }
    case 'TOGGLE_SAARTHI':     return { ...state, saarthiOpen: !state.saarthiOpen }
    case 'SET_CAL_MODAL':      return { ...state, calModal: action.payload }
    case 'SET_OCR_LINES':      return { ...state, ocrLines: action.payload }
    case 'TOGGLE_FAB_OVERLAY': return { ...state, fabOverlayOpen: !state.fabOverlayOpen }
    case 'TOGGLE_EXPORT':      return { ...state, exportOpen: !state.exportOpen }
    case 'SET_CAL_ASK':        return { ...state, calAskTask: action.payload }
    case 'SET_SYNC':           return { ...state, syncStatus: action.payload }
    case 'TOGGLE_KWM':         return { ...state, kwmOpen: !state.kwmOpen }
    case 'SET_CAL_KEYWORDS':   return { ...state, calKeywords: action.payload }
    case 'SET_DETAIL':         return { ...state, detail: action.payload }
    case 'SET_DHAIRYA':        return { ...state, dhairyaId: action.payload }
    case 'SET_LEISURE':        return { ...state, leisure: action.payload.leisure,
                                        pendingGather: action.payload.pending !== undefined ? action.payload.pending : state.pendingGather }
    case 'SET_EXPORT':         return { ...state, exportJson: action.payload }
    default: return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  // Latest tasks for async callbacks (AI classify / link resolve after a round trip).
  const tasksRef = useRef(state.tasks)
  tasksRef.current = state.tasks
  const sessionAdded = useRef(0)

  // Persist krishnaMode changes to localStorage
  useEffect(() => {
    localStorage.setItem('chakra_krishna_mode', JSON.stringify(state.krishnaMode))
  }, [state.krishnaMode])

  // Persist calKeywords changes to localStorage
  useEffect(() => {
    localStorage.setItem('chakra_cal_keywords', JSON.stringify(state.calKeywords))
  }, [state.calKeywords])

  // On mount: restore session from localStorage
  useEffect(() => {
    // Restore krishnaMode
    try {
      const km = localStorage.getItem('chakra_krishna_mode')
      if (km !== null) dispatch({ type: 'SET_KRISHNA', payload: JSON.parse(km) })
    } catch {}

    const token = localStorage.getItem('chakra_token')
    const userRaw = localStorage.getItem('chakra_user')
    if (token && userRaw) {
      try {
        const user = JSON.parse(userRaw)
        dispatch({ type: 'SET_USER', payload: { user, token } })
        dispatch({ type: 'SET_LOADING', payload: true })
        getTasks()
          .then(tasks => {
            dispatch({ type: 'SET_TASKS', payload: tasks })
            dispatch({ type: 'SET_SYNC', payload: `✓ synced · ${tasks.length} tasks` })
          })
          .catch(() => dispatch({ type: 'SET_SYNC', payload: '⚠ load failed' }))
          .finally(() => dispatch({ type: 'SET_LOADING', payload: false }))
      } catch {}
    }
  }, [])

  const doLogin = useCallback(async (userId, password) => {
    const data = await apiLogin(userId, password)
    localStorage.setItem('chakra_token', data.access_token)
    localStorage.setItem('chakra_user', JSON.stringify({ userId: data.user_id, displayName: data.display_name }))
    dispatch({ type: 'SET_USER', payload: { user: { userId: data.user_id, displayName: data.display_name }, token: data.access_token } })
    dispatch({ type: 'SET_LOADING', payload: true })
    const tasks = await getTasks()
    dispatch({ type: 'SET_TASKS', payload: tasks })
    dispatch({ type: 'SET_SYNC', payload: `✓ synced · ${tasks.length} tasks` })
    dispatch({ type: 'SET_LOADING', payload: false })
  }, [])

  const doLogout = useCallback(() => {
    localStorage.removeItem('chakra_token')
    localStorage.removeItem('chakra_user')
    dispatch({ type: 'LOGOUT' })
  }, [])

  const addTask = useCallback(async (taskData) => {
    const task = await createTask(taskData)
    dispatch({ type: 'ADD_TASK', payload: task })
    return task
  }, [])

  const patchTask = useCallback(async (id, updates) => {
    const task = await updateTask(id, updates)
    dispatch({ type: 'UPDATE_TASK', payload: task })
    return task
  }, [])

  const doClearCompleted = useCallback(async () => {
    await apiClearCompleted()
    dispatch({ type: 'SET_TASKS', payload: state.tasks.filter(t => !t.completed) })
  }, [state.tasks])

  const doImport = useCallback(async (tasks) => {
    const result = await apiBulkImport(tasks)
    const fresh = await getTasks()
    dispatch({ type: 'SET_TASKS', payload: fresh })
    return result
  }, [])

  const showToast = useCallback((msg, type = 'ok', duration = 2200) => {
    dispatch({ type: 'SHOW_TOAST', payload: { msg, type } })
    setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), duration)
  }, [])

  const findTask = useCallback(id => tasksRef.current.find(t => t.id === id), [])

  // Link two tasks both ways so the Dhairya menu cascades either direction.
  const linkTasks = useCallback(async (idA, idB) => {
    const a = findTask(idA), b = findTask(idB)
    if (!a || !b) return
    const la = Array.from(new Set([...(a.linkedTasks || []), idB]))
    const lb = Array.from(new Set([...(b.linkedTasks || []), idA]))
    try {
      await patchTask(idA, { linkedTasks: la })
      await patchTask(idB, { linkedTasks: lb })
    } catch { /* silent — no link is the safe default */ }
  }, [findTask, patchTask])

  const unlinkTask = useCallback(async (id, otherId) => {
    const a = findTask(id), b = findTask(otherId)
    try {
      if (a) await patchTask(id, { linkedTasks: (a.linkedTasks || []).filter(x => x !== otherId) })
      if (b) await patchTask(otherId, { linkedTasks: (b.linkedTasks || []).filter(x => x !== id) })
    } catch {}
  }, [findTask, patchTask])

  // V9 commitTasks — the single save path for Gather, Quick Add and photo scan.
  // Rule 15: weight is mandatory, default W2. Leisure tasks go to Vishram with no
  // horizon and skip AI classification.
  const commitTasks = useCallback(async (lines, useW, useMT, useTH, useLA, isLeisure) => {
    const weightFinal = useW || 'W2'
    const created = []
    for (let i = 0; i < lines.length; i++) {
      const clean = (lines[i] || '').trim()
      if (!clean) continue
      const nowIso = new Date().toISOString()
      const placeholderBucket = isLeisure ? 'Vishram' : 'Karya'
      try {
        const task = await addTask({
          id: `task_${Date.now()}${i}`,
          title: clean,
          shortTitle: shortTitleFrom(clean),
          bucket: placeholderBucket,
          ch: 3,
          weightage: weightFinal,
          timeHorizonType: isLeisure ? null : useTH,
          lifeArea: useLA,
          multitask: useMT,
          stateHistory: [{ bucket: placeholderBucket, timestamp: nowIso }],
          transitionCount: 0,
          originBucket: placeholderBucket,
          completed: false,
          entryTimestamp: nowIso,
          agingDays: 0,
          num: tasksRef.current.length + 1,
        })
        created.push(task)
        if (!isLeisure) {
          // Rule 2/17/3: classify by context. Runs after the task is visible,
          // so entry is never blocked by the API.
          classifyTask(clean).then(async result => {
            const t = findTask(task.id) || task
            try {
              await patchTask(task.id, {
                bucket: result.bucket,
                ch: result.ch,
                ...(!t.lifeArea && result.lifeArea ? { lifeArea: result.lifeArea } : {}),
                stateHistory: [...(t.stateHistory || []), { bucket: result.bucket, timestamp: new Date().toISOString() }],
              })
            } catch {}
          })
          // Silent auto-linking — only once the backend stores links.
          if (task.linkedTasks !== undefined) {
            detectLink(clean, task.id, tasksRef.current).then(linkedId => {
              if (linkedId) linkTasks(task.id, linkedId)
            })
          }
        }
      } catch {
        showToast('Failed to save task', 'warn')
      }
    }
    if (!created.length) return created

    // Remind to back up every 3 tasks added this session.
    sessionAdded.current += created.length
    if (sessionAdded.current >= 3 && sessionAdded.current % 3 === 0) {
      const n = sessionAdded.current
      setTimeout(() => showToast(`💾 ${n} tasks added this session — tap Backup JSON to save safely`, 'warn', 4500), 1200)
    }
    showToast(created.length === 1 ? '✓ 1 task added to Chakra ＋' : `✓ ${created.length} tasks added to Chakra ＋`, 'ok', 3000)
    // Offer calendar scheduling for single tasks.
    if (lines.length === 1) {
      setTimeout(() => dispatch({ type: 'SET_CAL_ASK', payload: { title: created[0].title } }), 900)
    }
    return created
  }, [addTask, patchTask, findTask, linkTasks, showToast])

  const setKeywords = useCallback((cat, keywords) => {
    const updated = { ...state.calKeywords, [cat]: keywords }
    dispatch({ type: 'SET_CAL_KEYWORDS', payload: updated })
  }, [state.calKeywords])

  const value = {
    state,
    dispatch,
    doLogin,
    doLogout,
    addTask,
    patchTask,
    doClearCompleted,
    doImport,
    showToast,
    setKeywords,
    commitTasks,
    linkTasks,
    unlinkTask,
    findTask,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
