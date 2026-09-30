import { W_MAP, W_LABEL, GITA } from './constants'

// ─── V9 deadline / heat rule ────────────────────────────────────────────────
// A horizon label is turned into a deadline anchored to the task's own entry
// date. Heat: green = on/before deadline, amber = up to 30% of the task's own
// window past due, red = beyond 30%.
export function taskDeadline(t) {
  if (!t.timeHorizonType || t.timeHorizonType === 'parkingLot') return null
  const entry = t.entryTimestamp ? new Date(t.entryTimestamp) : new Date()
  const entryDay = new Date(entry.getFullYear(), entry.getMonth(), entry.getDate())
  const yr = entryDay.getFullYear()
  const dl = {
    // End of the entry day, so a task added today is not overdue until tomorrow
    // (matches the pre-V9 behaviour for 'today').
    today: new Date(entryDay.getTime() + 86400000),
    thisWeek: new Date(entryDay.getTime() + 7 * 86400000),
    nextWeek: new Date(entryDay.getTime() + 14 * 86400000),
    thisMonth: new Date(entryDay.getTime() + 30 * 86400000),
    Q3: new Date(yr, 8, 30),
    Q4: new Date(yr, 11, 31),
    thisYear: new Date(yr, 11, 31),
    '1year': new Date(yr + 1, 11, 31),
    '2years': new Date(yr + 2, 11, 31),
  }
  return dl[t.timeHorizonType] || null
}

// Older records use completionDate; new completions write completedTimestamp.
export function completedAt(t) {
  return t.completedTimestamp || t.completionDate || null
}

export function heatPct(t) {
  const dl = taskDeadline(t)
  if (!dl) return null
  const entry = t.entryTimestamp ? new Date(t.entryTimestamp) : new Date()
  const winDays = Math.max(1, (dl - entry) / 86400000)
  const pastDays = (Date.now() - dl.getTime()) / 86400000
  if (pastDays <= 0) return 0
  return Math.round(pastDays / winDays * 100)
}

// Rule 10: Manan, Manthan and Vishram enter Tamas after 3 months with no move
// or completion. Only a move or completion resets the clock.
export const TAMAS_BUCKETS = { Manan: 1, Manthan: 1, Vishram: 1 }

export function lastMoveDate(t) {
  const sh = t.stateHistory
  if (!sh || !sh.length) return new Date(t.entryTimestamp || Date.now())
  return new Date(sh[sh.length - 1].timestamp)
}

export function isTamas(t) {
  if (t.completed || !TAMAS_BUCKETS[t.bucket]) return false
  return (Date.now() - lastMoveDate(t).getTime()) / 86400000 >= 90
}

// Mutually exclusive with Tamas — a task is never double-counted.
export function isOD(t) {
  if (t.completed || isTamas(t)) return false
  const p = heatPct(t)
  return p !== null && p > 0
}

export function tcol(t) {
  const p = heatPct(t)
  if (p === null) return 'var(--text-faint)'
  if (p <= 0) return 'var(--green)'
  if (p <= 30) return 'var(--amber)'
  return 'var(--red)'
}

export function tborder(t) {
  const p = heatPct(t)
  if (p === null) return ''
  if (p <= 0) return ' tc-g'
  if (p <= 30) return ' tc-a'
  return ' od'
}

export function heatText(t) {
  const hp = heatPct(t)
  return hp === null ? 'No deadline set'
    : hp <= 0 ? 'On time'
    : hp <= 30 ? 'Past due, within 30% grace'
    : 'Past due, beyond 30% — red'
}

// ─── Battery ────────────────────────────────────────────────────────────────
export function computeBattery(tasks) {
  const active = tasks.filter(t => !t.completed)
  const tamasT = active.filter(isTamas)
  const tamasIds = new Set(tamasT.map(t => t.id))
  const rest = active.filter(t => !tamasIds.has(t.id))
  const odT = rest.filter(isOD)
  const odIds = new Set(odT.map(t => t.id))
  const todayT = rest.filter(t => t.timeHorizonType === 'today' && !odIds.has(t.id))
  const weekT = rest.filter(t => t.timeHorizonType === 'thisWeek' && !odIds.has(t.id))
  const nwT = rest.filter(t => t.timeHorizonType === 'nextWeek' && !odIds.has(t.id))
  const laterT = rest.filter(t => !odIds.has(t.id)
    && t.timeHorizonType !== 'today'
    && t.timeHorizonType !== 'thisWeek'
    && t.timeHorizonType !== 'nextWeek')

  const odDrain = odT.reduce((s, t) => s + Math.min(10 + (t.agingDays || 1) * 2, 20), 0)
  const heavy = active.filter(t => (t.weightage === 'W4' || t.weightage === 'W5') && (t.agingDays || 0) > 7).length
  const drain = Math.min(odDrain + heavy * 8 + tamasT.length * 4, 100)
  const charge = Math.max(0, 100 - drain)
  const chCol = charge > 70 ? '#2E7D32' : charge > 40 ? '#B87800' : charge > 20 ? '#8B5A00' : '#8B1A1A'
  const drainLabel = drain > 75 ? 'Critical drain' : drain > 50 ? 'High drain' : drain > 25 ? 'Moderate drain' : 'Low drain'

  return { active, tamasT, odT, todayT, weekT, nwT, laterT, charge, drain, chCol, drainLabel }
}

// ─── Labels ─────────────────────────────────────────────────────────────────
export const HORIZON_LABEL = {
  today: 'Today', thisWeek: 'This week', nextWeek: 'Next week', thisMonth: 'Next month',
  Q3: 'Q3 2026', Q4: 'Q4 2026', thisYear: 'This year', '1year': '1–2 years',
  '2years': '2 years', parkingLot: 'Parking lot', later: 'Later',
}

export function horizonLabel(code) {
  if (!code) return null
  return HORIZON_LABEL[code] || code
}

export function arenaNameOf(ch) {
  const g = GITA.find(x => x.ch === ch)
  return g ? g.name : ''
}

// Rule 20-adjacent: short, self-explanatory title condensed from a long
// dictated one — first clause up to the first filler phrase, capped at ~60 chars.
export function shortTitleFrom(text) {
  if (!text) return ''
  let t = text.split(/\.\s|\bThis (activity|would|search|would take)\b/i)[0].trim()
  if (t.length > 60) t = t.slice(0, 57).replace(/\s+\S*$/, '') + '…'
  return t
}

// The title to show on a card: the short title stored when the task was
// created, else the full title (as V9 does — existing tasks keep full titles).
export function displayTitle(t) {
  return t.shortTitle || t.title
}

// Rule 3: any conflict auto-assigns to Manthan, as a fast pre-check before AI.
const CONFLICT_KEYWORDS = /\bconflict|clash|overlap|double.?book|two meetings|which one|torn between|can'?t decide|decide between\b/i
export function isConflictTask(text) { return CONFLICT_KEYWORDS.test(text || '') }

// ─── Keyword parsers (commentary → metadata, no API) ────────────────────────
export function parseWeightage(text) {
  if (!text) return null
  const t = text.toLowerCase()
  if (/full.day|all.day|whole.day/.test(t)) return 'W5'
  if (/half.day|4.hour|four.hour/.test(t)) return 'W4'
  if (/\b(1|one)\s*hour|\b60\s*min/.test(t)) return 'W3'
  if (/\b(2|two|3|three)\s*hour/.test(t)) return 'W4'
  if (/30\s*min|half.hour|thirty\s*min/.test(t)) return 'W2'
  if (/\b(5|10|15)\s*min|quick|fast|brief/.test(t)) return 'W1'
  return null
}

export function parseMultitask(text) {
  if (!text) return null
  const t = text.toLowerCase()
  if (/multi.task|multitask|driving|walking|can.do|while.driv|while.walk/.test(t)) return true
  if (/full.focus|no.multitask|focus.only|needs.focus/.test(t)) return false
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
