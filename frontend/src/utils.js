import { W_MAP, W_LABEL } from './constants'

export function timeScore(t) {
  if (!t.timeHorizonType || t.timeHorizonType === 'parkingLot') return 999
  const now = new Date()
  const tod = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yr = tod.getFullYear()
  const dl = {
    today: 0,
    thisWeek: 7,
    nextWeek: 14,
    thisMonth: 30,
    Q3: Math.round((new Date(yr, 8, 30) - tod) / 86400000),
    Q4: Math.round((new Date(yr, 11, 31) - tod) / 86400000),
    thisYear: Math.round((new Date(yr, 11, 31) - tod) / 86400000),
    '1year': 365,
    '2years': 730
  }
  const d = dl[t.timeHorizonType]
  if (d === undefined) return 999
  const win = (t.timeHorizonType === 'today' || t.timeHorizonType === 'thisWeek' || t.timeHorizonType === 'nextWeek') ? 7
    : t.timeHorizonType === 'thisMonth' ? 14 : 30
  if (win === 0) return d <= 0 ? 0 : 999
  return Math.round(((d - win) / win) * 100)
}

export function isOD(t) {
  if (t.completed || !t.timeHorizonType || t.timeHorizonType === 'parkingLot') return false
  const now2 = new Date(); now2.setHours(0, 0, 0, 0)
  const yr = now2.getFullYear()
  const horizonDeadline = {
    today: new Date(now2),
    thisWeek: new Date(now2.getTime() + 7 * 86400000),
    nextWeek: new Date(now2.getTime() + 14 * 86400000),
    thisMonth: new Date(now2.getTime() + 30 * 86400000),
    Q3: new Date(yr, 8, 30),
    Q4: new Date(yr, 11, 31),
    thisYear: new Date(yr, 11, 31),
    '1year': new Date(yr + 1, 11, 31),
    '2years': new Date(yr + 2, 11, 31)
  }
  const deadline = horizonDeadline[t.timeHorizonType]
  if (!deadline) return false
  const entry = t.entryTimestamp ? new Date(t.entryTimestamp) : null
  if (!entry) return false
  if (t.timeHorizonType === 'today') {
    const entryDay = new Date(entry.getFullYear(), entry.getMonth(), entry.getDate())
    return entryDay < now2
  }
  if (t.timeHorizonType === 'thisWeek') {
    const entryDay = new Date(entry.getFullYear(), entry.getMonth(), entry.getDate())
    return (now2 - entryDay) > 7 * 86400000
  }
  if (t.timeHorizonType === 'nextWeek') {
    const entryDay = new Date(entry.getFullYear(), entry.getMonth(), entry.getDate())
    return (now2 - entryDay) > 14 * 86400000
  }
  if (t.timeHorizonType === 'thisMonth') {
    const entryDay = new Date(entry.getFullYear(), entry.getMonth(), entry.getDate())
    return (now2 - entryDay) > 30 * 86400000
  }
  return now2 > deadline
}

export function tcol(t) {
  const s = timeScore(t)
  if (isOD(t) || s <= 0) return 'var(--red)'
  if (s > 400) return 'var(--ocean)'
  if (s > 200) return 'var(--green)'
  if (s > 100) return 'var(--amber)'
  return 'var(--teal2)'
}

export function computeCharge(tasks) {
  const active = tasks.filter(t => !t.completed)
  const odTasks = active.filter(isOD)
  const odDrain = odTasks.reduce((s, t) => s + Math.min(10 + (t.agingDays || 1) * 2, 20), 0)
  const heavy = active.filter(t => (t.weightage === 'W4' || t.weightage === 'W5') && (t.agingDays || 0) > 7).length
  const drain = Math.min(odDrain + heavy * 8, 100)
  const charge = Math.max(0, 100 - drain)
  const chCol = charge > 70 ? '#2E7D32' : charge > 40 ? '#B87800' : charge > 20 ? '#8B5A00' : '#8B1A1A'
  const drainLabel = drain > 75 ? 'Critical drain' : drain > 50 ? 'High drain' : drain > 25 ? 'Moderate drain' : 'Low drain'
  return { charge, drain, chCol, drainLabel }
}

export function computeBatterySegments(tasks) {
  const active = tasks.filter(t => !t.completed)
  const odTasks = active.filter(isOD)
  const odIds = new Set(odTasks.map(t => t.id))
  const todayT  = active.filter(t => t.timeHorizonType === 'today'    && !odIds.has(t.id))
  const weekT   = active.filter(t => t.timeHorizonType === 'thisWeek' && !odIds.has(t.id))
  const nwT     = active.filter(t => t.timeHorizonType === 'nextWeek' && !odIds.has(t.id))
  const laterT  = active.filter(t => !odIds.has(t.id) && t.timeHorizonType !== 'today' && t.timeHorizonType !== 'thisWeek' && t.timeHorizonType !== 'nextWeek')
  return { odT: odTasks, todayT, weekT, nwT, laterT }
}

export function parseWeightage(text) {
  if (!text) return null
  const t = text.toLowerCase()
  if (/full.day|all.day|whole.day/.test(t)) return 'W5'
  if (/half.day|4.hour|four.hour/.test(t)) return 'W4'
  if (/\b(2|two|3|three)\s*hour/.test(t)) return 'W4'
  if (/\b(1|one)\s*hour|\b60\s*min/.test(t)) return 'W3'
  if (/30\s*min|half.hour|thirty\s*min/.test(t)) return 'W2'
  if (/\b(5|10|15)\s*min|quick|fast|brief/.test(t)) return 'W1'
  return null
}

export function parseMultitask(text) {
  if (!text) return null
  const t = text.toLowerCase()
  if (/multi.task|multitask|driving|walking|can.do|while.driv|while.walk/.test(t)) return 'Yes'
  if (/full.focus|no.multitask|focus.only|needs.focus/.test(t)) return 'No'
  return null
}

export function parseHorizon(text) {
  if (!text) return null
  const t = text.toLowerCase()
  if (/\btoday\b|right.now|this.evening|tonight/.test(t)) return 'today'
  if (/\bmonday\b|\btuesday\b|\bwednesday\b|\bthursday\b|\bfriday\b|\bsaturday\b|\bsunday\b|this.week|coming.day/.test(t)) return 'thisWeek'
  if (/next.week/.test(t)) return 'nextWeek'
  if (/next.month|this.month|30.day|end.of.month/.test(t)) return 'thisMonth'
  if (/q3|july|august|september/.test(t)) return 'Q3'
  if (/q4|october|november|december/.test(t)) return 'Q4'
  if (/this.year|by.year|end.of.year/.test(t)) return 'thisYear'
  return null
}

export function formatDate() {
  const dn = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const now = new Date()
  return dn[now.getDay()].toUpperCase() + ', ' + mn[now.getMonth()] + ' ' + now.getDate() + ' ' + now.getFullYear()
}

export function wLabel(w) {
  return W_LABEL[w] || ''
}

export function wMap(w) {
  return W_MAP[w] || 0
}

export function esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

export function suggestCalendar(title, calKeywords) {
  const t = (title || '').toLowerCase()
  if (calKeywords.picturizze.some(k => t.includes(k))) return 'picturizze'
  if (calKeywords.personal.some(k => t.includes(k))) return 'personal'
  if (calKeywords.itc.some(k => t.includes(k))) return 'itc'
  return null
}
