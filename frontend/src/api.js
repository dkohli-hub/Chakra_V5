import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('chakra_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('chakra_token')
      localStorage.removeItem('chakra_user')
      window.location.reload()
    }
    return Promise.reject(err)
  }
)

// --- Normalise snake_case API response to camelCase frontend ---
export function normaliseTask(t) {
  return {
    id: t.id,
    userId: t.user_id,
    num: t.num,
    title: t.title,
    bucket: t.bucket,
    weightage: t.weightage,
    timeHorizon: t.time_horizon,
    timeHorizonType: t.time_horizon,
    lifeArea: t.life_area,
    ch: t.ch,
    multitask: t.multitask === true ? 'Yes' : t.multitask === false ? 'No' : t.multitask,
    stateHistory: t.state_history || [],
    transitionCount: t.transition_count || 0,
    originBucket: t.origin_bucket,
    completed: t.completed,
    completedTimestamp: t.completed_timestamp,
    entryTimestamp: t.entry_timestamp,
    agingDays: t.aging_days || 0,
  }
}

// --- Denormalise camelCase frontend to snake_case for API ---
export function denormaliseTask(t) {
  return {
    id: t.id,
    num: t.num,
    title: t.title,
    bucket: t.bucket,
    weightage: t.weightage,
    time_horizon: t.timeHorizonType || t.timeHorizon,
    life_area: t.lifeArea,
    ch: t.ch,
    multitask: t.multitask === 'Yes' ? true : t.multitask === 'No' ? false : t.multitask,
    origin_bucket: t.originBucket,
    state_history: t.stateHistory || [],
    transition_count: t.transitionCount || 0,
    completed: t.completed,
    completed_timestamp: t.completedTimestamp,
    entry_timestamp: t.entryTimestamp,
    aging_days: t.agingDays || 0,
  }
}

export const login = (userId, password) =>
  api.post('/auth/login', { user_id: userId, password }).then((r) => r.data)

export const getTasks = () =>
  api.get('/tasks').then((r) => r.data.map(normaliseTask))

export const createTask = (taskData) =>
  api.post('/tasks', denormaliseTask(taskData)).then((r) => normaliseTask(r.data))

export const updateTask = (id, updates) => {
  const payload = {}
  if (updates.title !== undefined) payload.title = updates.title
  if (updates.bucket !== undefined) payload.bucket = updates.bucket
  if (updates.weightage !== undefined) payload.weightage = updates.weightage
  if (updates.timeHorizonType !== undefined) payload.time_horizon = updates.timeHorizonType
  if (updates.timeHorizon !== undefined) payload.time_horizon = updates.timeHorizon
  if (updates.lifeArea !== undefined) payload.life_area = updates.lifeArea
  if (updates.ch !== undefined) payload.ch = updates.ch
  if (updates.multitask !== undefined) payload.multitask = updates.multitask === 'Yes' ? true : updates.multitask === 'No' ? false : updates.multitask
  if (updates.completed !== undefined) payload.completed = updates.completed
  if (updates.completedTimestamp !== undefined) payload.completed_timestamp = updates.completedTimestamp
  if (updates.stateHistory !== undefined) payload.state_history = updates.stateHistory
  if (updates.transitionCount !== undefined) payload.transition_count = updates.transitionCount
  if (updates.agingDays !== undefined) payload.aging_days = updates.agingDays
  return api.patch(`/tasks/${id}`, payload).then((r) => normaliseTask(r.data))
}

export const deleteTask = (id) =>
  api.delete(`/tasks/${id}`).then((r) => r.data)

export const clearCompleted = () =>
  api.delete('/tasks').then((r) => r.data)

export const bulkImport = (tasks) =>
  api.post('/tasks/import', { tasks }).then((r) => r.data)

export const parseLLM = (prompt) =>
  api.post('/llm/parse', { prompt }).then((r) => r.data.text)

export const scanOCR = (imageBase64) =>
  api.post('/ocr/scan', { image_base64: imageBase64 }).then((r) => r.data.text)

export default api
