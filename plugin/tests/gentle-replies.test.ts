import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

/** The engine beneath the plugin: answers what it calls, keeps a store, records prompts. */
function engine(on: On) {
  const clock = mock.clock(on)
  const seen = { prompts: [] as string[], commands: [] as string[], clock }
  const store = new Map<string, unknown>()
  on('command.register', ($, e) => {
    seen.commands.push(e.name)
    return { value: { command: e.name } }
  })
  on('session.start', () => ({ cwd: 'C:/project' }))
  on('prompt.submit', ($, e) => {
    seen.prompts.push(e.text)
    return { text: e.text }
  })
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('store.get', ($, e) => ({ value: store.get(e.key) }))
  on('store.set', ($, e) => {
    store.set(e.key, JSON.parse(JSON.stringify(e.value)))
    return { value: undefined }
  })
  on('tool.call', ($, e) => {
    const command = (e as { command?: string }).command ?? ''
    if (command.includes('fails')) return { result: undefined, isError: true, text: 'exit 1' } as never
    return { result: undefined, text: 'ok' } as never
  })
  return seen
}

const START = { cwd: 'C:/project', surface: 'desktop', isInteractive: true } as const
const typed = (text: string) => ({ text, origin: { kind: 'composer' } }) as never
const done = (answer: string, extra: Record<string, unknown> = {}) =>
  ({ turnId: 't1', answer, durationMs: 1000, isAborted: false, reason: 'answer', ...extra }) as never

const SHAPED = `Fixed the sign-in bug. One call for you.

### Your call

> **Push the fix to the live site?**
> My pick: **yes**.

### Done

- **Sign-in:** the form now sends the right field. Changed login.ts.`

test('a reply in the shape that names its changes gets no check line', async ($, on) => {
  engine(on)
  await $.session.start(START as never)
  await $.prompt.submit(typed('fix sign-in'))
  await $.tool.call({ tool: 'Edit', file_path: 'C:/project/src/login.ts', old_string: 'a', new_string: 'b' } as never)
  const out = (await $.turn.complete(done(SHAPED))) as { text: string }
  expect(out.text).toBe(SHAPED)
})

test('a long reply without the shape gets one quiet line under it', async ($, on) => {
  engine(on)
  await $.session.start(START as never)
  await $.prompt.submit(typed('review this'))
  const long = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ')
  const out = (await $.turn.complete(done(long))) as { text: string }
  expect(out.text).toContain('Reply check: a long reply (300 words) without the reply shape')
  expect(out.text).toContain('/calm')
})

test('a question outside Your call is flagged, one inside is not', async ($, on) => {
  engine(on)
  await $.session.start(START as never)
  await $.prompt.submit(typed('go'))
  const inside = (await $.turn.complete(done(SHAPED))) as { text: string }
  expect(inside.text).not.toContain('Reply check')

  await $.prompt.submit(typed('go'))
  const buried = `${SHAPED}\n\nShould I also update the README?`
  const out = (await $.turn.complete(done(buried))) as { text: string }
  expect(out.text).toContain('a question sits outside Your call: "Should I also update the README?"')
})

test('a changed file the reply does not name is flagged; notes files are not', async ($, on) => {
  engine(on)
  await $.session.start(START as never)
  await $.prompt.submit(typed('tidy up'))
  await $.tool.call({ tool: 'Write', file_path: 'C:/project/config/site.json', content: '{}' } as never)
  await $.tool.call({ tool: 'Edit', file_path: 'C:/project/TRACKER.md', old_string: 'a', new_string: 'b' } as never)
  const out = (await $.turn.complete(done('Tidied up. Nothing needs you.'))) as { text: string }
  expect(out.text).toContain('changed but not named in the reply: site.json')
  expect(out.text).not.toContain('TRACKER.md')
})

test('a failed command counts only if it never worked later and the reply stays silent', async ($, on) => {
  engine(on)
  await $.session.start(START as never)
  await $.prompt.submit(typed('build it'))
  await $.tool.call({ tool: 'Bash', command: 'npm run build fails' } as never)
  await $.tool.call({ tool: 'Bash', command: 'npm run build' } as never)
  await $.tool.call({ tool: 'PowerShell', command: 'pnpm test fails' } as never)
  const silent = (await $.turn.complete(done('Built. Nothing needs you.'))) as { text: string }
  expect(silent.text).toContain("a command failed and the reply doesn't say so: `pnpm test fails`")
  expect(silent.text).not.toContain('npm run build')

  await $.prompt.submit(typed('again'))
  await $.tool.call({ tool: 'PowerShell', command: 'pnpm test fails' } as never)
  const honest = (await $.turn.complete(done('Built. Not checked: the tests failed on a missing key.'))) as { text: string }
  expect(honest.text).not.toContain('Reply check')
})

test('subagent turns and Session Guardian autosaves are not checked', async ($, on) => {
  engine(on)
  await $.session.start(START as never)
  await $.prompt.submit(typed('go'))
  const long = Array.from({ length: 300 }, () => 'word').join(' ')
  const agent = (await $.turn.complete(done(long, { agentId: 'a1' }))) as { text: string }
  expect(agent.text).toBe(long)

  await $.prompt.submit({ text: 'Autosave from session-guardian', origin: { kind: 'plugin', name: 'session-guardian' } } as never)
  const save = (await $.turn.complete(done(long))) as { text: string }
  expect(save.text).toBe(long)
})

test('/gentle off mutes the check and tells the model; /gentle on brings it back', async ($, on) => {
  engine(on)
  await $.session.start(START as never)
  const offRun = (await $.command.run({ command: 'gentle', args: 'off' } as never)) as { text: string; context?: string[] }
  expect(offRun.text).toContain('off for this session')
  expect(offRun.context?.[0]).toContain('skip the Reply shape')

  await $.prompt.submit(typed('go'))
  const long = Array.from({ length: 300 }, () => 'word').join(' ')
  const muted = (await $.turn.complete(done(long))) as { text: string }
  expect(muted.text).toBe(long)

  const onRun = (await $.command.run({ command: 'gentle', args: 'on' } as never)) as { text: string; context?: string[] }
  expect(onRun.context?.[0]).toContain('use the Reply shape')
})

test('/gentle shows today\'s numbers', async ($, on) => {
  engine(on)
  await $.session.start(START as never)
  await $.prompt.submit(typed('go'))
  await $.turn.complete(done(SHAPED))
  await $.prompt.submit(typed('go'))
  await $.turn.complete(done(Array.from({ length: 300 }, () => 'word').join(' ')))
  const run = (await $.command.run({ command: 'gentle', args: '' } as never)) as { text: string }
  expect(run.text).toContain('Reply shape is on in this session')
  expect(run.text).toContain('Today: 2 replies, 1 in the shape, 1 long ones without it, 1 with a check line.')
})

test('/calm asks for the last long reply again in the shape', async ($, on) => {
  const seen = engine(on)
  await $.session.start(START as never)
  expect(seen.commands).toContain('calm')
  expect(seen.commands).toContain('gentle')
  const run = (await $.command.run({ command: 'calm', args: '' } as never)) as { text: string }
  expect(run.text).toContain('reply shape')
  await seen.clock.advance(10)
  expect(seen.prompts.at(-1)).toContain('Rewrite your last long reply in the Reply shape')
})
