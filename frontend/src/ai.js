// V9 AI helpers. Same prompts as the V9 prototype, but routed through our own
// backend (/llm/parse) rather than calling the Anthropic API from the browser.
import { parseLLM } from './api'
import { GITA, BUCKET_TESTS } from './constants'
import { isConflictTask } from './utils'

const FALLBACK = { bucket: 'Karya', ch: 3, lifeArea: null }

function parseJson(text) {
  const clean = (text || '').replace(/```json|```/g, '').trim()
  const m = clean.match(/\{[\s\S]*\}/)
  return JSON.parse(m ? m[0] : clean)
}

// Bucket + arena + life-area classification per DK's Gita rule book.
// Never throws: any failure resolves to Karya / arena 3 / no life area.
export async function classifyTask(title) {
  if (isConflictTask(title)) return { bucket: 'Manthan', ch: 1, lifeArea: null }

  // Manthan only via the conflict rule or DK.
  const bucketList = Object.keys(BUCKET_TESTS).filter(b => b !== 'Manthan')
  const testsText = bucketList
    .map(b => `${b}: ${BUCKET_TESTS[b].principle} — "${BUCKET_TESTS[b].question}"`)
    .join('\n')
  const arenaText = GITA.map(g => `${g.ch}. ${g.name} — ${g.essence}`).join('\n')
  const prompt = `Classify this task for DK's Chakra app. Task: "${title}"\n\n`
    + `Pick exactly one bucket from this list, using the test for each (pick the bucket whose question the task answers "yes" to):\n${testsText}\n\n`
    + `Pick exactly one arena (1-18) whose essence best matches the task:\n${arenaText}\n\n`
    + 'Pick one life area: Personal/Family, Work/Employment, Picturizze, Travel, Other.\n\n'
    + 'Respond with ONLY raw JSON, no markdown, no explanation: {"bucket":"...","ch":N,"lifeArea":"..."}'

  try {
    const parsed = parseJson(await parseLLM(prompt))
    if (!BUCKET_TESTS[parsed.bucket]) parsed.bucket = 'Karya'
    if (!parsed.ch || parsed.ch < 1 || parsed.ch > 18) parsed.ch = 3
    return parsed
  } catch {
    return { ...FALLBACK }
  }
}

// Silent auto-linking — "I don't need to link, AI needs to link." Compares only
// against OPEN, incomplete tasks entered in the last 7 days. Returns the id of
// the task to link, or null. No link is the safe default.
export async function detectLink(title, newId, tasks) {
  const since = Date.now() - 7 * 86400000
  const candidates = tasks.filter(t =>
    t.id !== newId && !t.completed && t.entryTimestamp
    && new Date(t.entryTimestamp).getTime() >= since)
  if (!candidates.length) return null

  const list = candidates.map(t => `${t.id}: ${t.title}`).join('\n')
  const prompt = `New task: "${title}"\n\nExisting open tasks from the last 7 days:\n${list}\n\n`
    + 'Does the new task genuinely depend on, or is it blocked by, exactly one of these '
    + '(e.g. it only makes sense once the other is answered/done)? Only say yes if truly confident. '
    + 'Respond with ONLY raw JSON, no markdown: {"linkedId":"<id or null>"}'

  try {
    const parsed = parseJson(await parseLLM(prompt))
    if (!parsed.linkedId || parsed.linkedId === 'null') return null
    return candidates.some(c => c.id === parsed.linkedId) ? parsed.linkedId : null
  } catch {
    return null
  }
}
