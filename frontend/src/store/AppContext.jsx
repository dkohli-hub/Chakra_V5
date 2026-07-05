import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import { getTasks, login as apiLogin, createTask, updateTask, clearCompleted as apiClearCompleted, bulkImport as apiBulkImport } from '../api'

const AppContext = createContext(null)

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
    default: return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // On mount: restore session from localStorage
  useEffect(() => {
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
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
