import type { EngineInterface, Register } from 'claude-code'

const PLUGIN = 'gentle-replies'

/**
 * The reply shape itself lives in ~/.claude/CLAUDE.md ("Reply shape"), so every session follows
 * it without this mod. The mod adds three things around it:
 * - a check under each long reply, shown only when something looks off;
 * - /calm, which asks for the last long reply again in the shape;
 * - /gentle, which shows today's numbers and turns the shape off or on for one session.
 */

const SHAPE_HEADING = /^###\s+(Your call|Worth a look|Done)\b/im
const YOUR_CALL = /^###\s+Your call\b/im
const NEXT_HEADING = /^#{1,3}\s+/m
const CODE_BLOCK = /```[\s\S]*?```/g

/** The session's own notes and memory: writing them is bookkeeping, not news for the reply. */
const NOTES_FILE = /^(tracker|sessions|memory)(-archive)?\.md$|handover[^\\/]*\.md$/i
const QUIET_DIR = /[\\/]\.claude[\\/]projects[\\/][^\\/]+[\\/]memory[\\/]|[\\/]AppData[\\/]Local[\\/]Temp[\\/]/i
const CHANGES = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit'])
/** Words a reply uses when it owns up to a failure. */
const OWNS_UP = /\bfail|\berror|could ?n[o']t|did ?n[o']t|\bnot checked|\bbroke|\bblocked|\bstill red\b/i

const CALM_PROMPT =
  'Rewrite your last long reply in the Reply shape from my global CLAUDE.md: lead line, ### Your call, ' +
  '### Worth a look, ### Done, then Parked, Reference and Not checked lines. If that section is not in ' +
  'your instructions, read it from ~/.claude/CLAUDE.md first. Keep every fact, number, path, call for me ' +
  'and risk; add nothing new and change nothing else. If the reply already has the shape, say so in one line.'

const OFF_NOTE =
  'For the rest of this session, skip the Reply shape from my CLAUDE.md and answer in plain prose. ' +
  'Everything else in my rules still applies.'
const ON_NOTE = 'From now on in this session, use the Reply shape from my CLAUDE.md again.'

/** Settings, read from the manifest's userConfig when the module loads. */
const cfg = { check: true, longWords: 250 }

/** This session: the shape switched off with /gentle off. */
let off = false

/** The main turn now running, as far as the check needs it. */
const turn = {
  /** Files the main loop changed, by full path. */
  changed: new Set<string>(),
  /** The last failed command per program, cleared when the same program later works. */
  failed: new Map<string, string>(),
  /** Session Guardian's autosave and other plugins' prompts are not replies to check. */
  skip: false,
}

type Day = { replies: number; long: number; shaped: number; flagged: number }

const words = (text: string) => text.split(/\s+/).filter(Boolean).length
const baseName = (path: string) => path.split(/[\\/]/).at(-1) ?? path

/** The program a command runs, past any leading `cd somewhere &&`: `npm` for `cd app && npm test`. */
const program = (command: string) =>
  command.replace(/^(\s*(cd|Set-Location|pushd)\s+[^;&|]+(&&|;)\s*)+/i, '').trim().split(/\s+/)[0]!.toLowerCase()

const short = (text: string, max = 60) => {
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

/** Lines that ask the reader something: they end with a question mark once markdown is peeled off. */
function questions(text: string): string[] {
  return text
    .split('\n')
    .map(l => l.replace(/^[\s>*-]+|[\s*_)"'`]+$/g, ''))
    .filter(l => l.endsWith('?'))
}

/**
 * What looks off in a final reply. Pure, so the tests can call it directly.
 * Returns short phrases; the empty list means nothing to say.
 */
export function checkReply(answer: string, changed: Iterable<string>, failed: Iterable<string>, longWords: number): string[] {
  const text = answer.replace(CODE_BLOCK, '')
  const issues: string[] = []
  const shaped = SHAPE_HEADING.test(text)
  const n = words(text)

  if (!shaped && n >= longWords) issues.push(`a long reply (${n} words) without the reply shape; /calm reshapes it`)

  if (shaped) {
    const start = text.search(YOUR_CALL)
    let outside = text
    if (start >= 0) {
      // Your call runs from its heading line to the next heading.
      const lineEnd = text.indexOf('\n', start)
      const rest = lineEnd >= 0 ? text.slice(lineEnd) : ''
      const end = rest.search(NEXT_HEADING)
      outside = text.slice(0, start) + (end >= 0 ? rest.slice(end) : '')
    }
    const asked = questions(outside)
    if (asked.length) issues.push(`a question sits outside Your call: "${short(asked[0]!)}"`)
  }

  const lower = answer.toLowerCase()
  const unnamed = [...new Set([...changed].filter(p => !NOTES_FILE.test(baseName(p)) && !QUIET_DIR.test(p)).map(baseName))]
    .filter(name => !lower.includes(name.toLowerCase()))
  if (unnamed.length) {
    const list = unnamed.slice(0, 3).join(', ') + (unnamed.length > 3 ? ` and ${unnamed.length - 3} more` : '')
    issues.push(`changed but not named in the reply: ${list}`)
  }

  const stillFailing = [...failed]
  if (stillFailing.length && !OWNS_UP.test(answer)) {
    issues.push(`a command failed and the reply doesn't say so: \`${short(stillFailing[0]!, 50)}\``)
  }
  return issues
}

const today = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function count($: EngineInterface, answer: string, flagged: boolean) {
  const days = ((await $.store.get('days')) ?? {}) as Record<string, Day>
  const key = today(await $.clock.now())
  const day = days[key] ?? { replies: 0, long: 0, shaped: 0, flagged: 0 }
  day.replies += 1
  if (words(answer) >= cfg.longWords) day.long += 1
  if (SHAPE_HEADING.test(answer)) day.shaped += 1
  if (flagged) day.flagged += 1
  days[key] = day
  // Keep the last 60 days.
  const keep = Object.keys(days).sort().slice(-60)
  await $.store.set('days', Object.fromEntries(keep.map(k => [k, days[k]])))
}

async function report($: EngineInterface): Promise<string> {
  const days = ((await $.store.get('days')) ?? {}) as Record<string, Day>
  const keys = Object.keys(days).sort()
  const now = today(await $.clock.now())
  const d = days[now] ?? { replies: 0, long: 0, shaped: 0, flagged: 0 }
  const week = keys.slice(-7).map(k => days[k]!)
  const sum = (f: keyof Day) => week.reduce((a, x) => a + x[f], 0)
  return [
    `Reply shape is ${off ? 'off' : 'on'} in this session. /gentle off or /gentle on switches it.`,
    `Today: ${d.replies} replies, ${d.shaped} in the shape, ${d.long} long ones without it, ${d.flagged} with a check line.`,
    `Last ${week.length} days with replies: ${sum('replies')} replies, ${sum('shaped')} in the shape, ${sum('flagged')} with a check line.`,
  ].join('\n')
}

export const register: Register = (on, options) => {
  cfg.check = options.check !== false
  cfg.longWords = typeof options.longWords === 'number' && options.longWords > 0 ? options.longWords : 250

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'calm', description: 'Ask for the last long reply again in the reply shape' })
    await $.command.register({
      name: 'gentle',
      description: "Today's reply numbers; /gentle off or /gentle on switches the reply shape for this session",
    })
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    turn.changed.clear()
    turn.failed.clear()
    turn.skip = e.origin.kind === 'plugin' && e.origin.name !== PLUGIN
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId !== undefined) return ran
    const ok = ran.deny === undefined && ran.isError !== true
    const tool = String(e.tool)
    if (ok && CHANGES.has(tool)) {
      const path = (e as { file_path?: string; notebook_path?: string }).file_path ?? (e as { notebook_path?: string }).notebook_path
      if (path) turn.changed.add(path)
    }
    if (e.tool === 'Bash' || e.tool === 'PowerShell') {
      const command = e.command.trim()
      const prog = program(command)
      if (ok) turn.failed.delete(prog)
      else if (ran.deny === undefined) turn.failed.set(prog, command)
    }
    return ran
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined || e.reason !== 'answer' || turn.skip || !e.answer.trim()) return result

    const issues = off || !cfg.check ? [] : checkReply(e.answer, turn.changed, turn.failed.values(), cfg.longWords)
    await count($, e.answer, issues.length > 0)
    if (!issues.length) return result

    const line = `Reply check: ${issues.join(' · ')}.`
    const before = result.text && result.text !== e.answer ? `${result.text}\n` : ''
    return { ...result, text: before + line }
  })

  on('command.run', { command: 'calm' }, async $ => {
    $.clock.after(0, () => void $.prompt.submit({ text: CALM_PROMPT, asUser: true }))
    return { text: 'Asking for the last long reply again, in the reply shape.' }
  })

  on('command.run', { command: 'gentle' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'off') {
      off = true
      return { text: 'Reply shape off for this session. /gentle on brings it back.', context: [OFF_NOTE] }
    }
    if (arg === 'on') {
      off = false
      return { text: 'Reply shape on for this session.', context: [ON_NOTE] }
    }
    return { text: await report($) }
  })
}
