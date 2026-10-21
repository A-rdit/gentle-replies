# Gentle Replies

A Claude Code plugin and one CLAUDE.md rule that make long replies easy to take in. What needs
you comes first, what was done comes last, and nothing gets lost on the way.

## Why

A long reply from Claude mixes two kinds of things: work that was done, and things only you can
decide. When both arrive as one block of headings and bullets, the decision is easy to miss.
Often it sits in the last line. If you run several sessions at once, or find dense text hard to
take in, that's where things slip.

The rule gives every long reply the same order:

1. **A lead line:** what the turn was about, and whether anything needs you.
2. **Your call:** only what you alone can decide or do, in a quote block, one question at a
   time, with Claude's pick when it has one.
3. **Worth a look:** risks, surprises and costs. Things to know, not to act on.
4. **Done:** what was done, found or fixed. Quiet, past tense, one item per bullet with space
   around it.
5. **Closing lines:** Parked, Reference (no need to open), Not checked.

Linked files are reference only. Anything you need is in the reply itself, so you never have
to open a file to find out what Claude wants from you.

## What a reply looks like

```markdown
Fixed the sign-in bug and added a test. One call for you.

### Your call

> **Push the fix to the live site now?**
> It changes sign-in for every user. My pick: **yes**, the new test covers it.
> Say yes and I push it.

Later: you can delete the old `auth-v1` branch; nothing uses it.

### Worth a look

**The bug also hit password resets.** Resets sent since Monday used the wrong link; 14 people
got one.

### Done

- **Sign-in:** the form now sends the email field the server expects. Changed `login.ts`.

- **Test:** `login.test.ts` covers the case. 42 of 42 tests pass.

Reference (no need to open): `docs/auth.md`, how sign-in works end to end.

Not checked: the mobile app, which has its own sign-in screen.
```

## What the plugin does

- **A check under each reply.** One quiet line, shown only when something looks off:
  - a long reply (250 words or more) without the shape;
  - a question for you outside Your call;
  - a file the turn changed that the reply doesn't name (notes files such as `TRACKER.md` don't
    count);
  - a command that failed, never worked later, and the reply doesn't mention.

  It runs on your machine and makes no model calls. Subagents' replies and other plugins'
  prompts (such as Session Guardian's autosave) are not checked.
- **`/calm`** asks Claude for its last long reply again, in the shape.
- **`/gentle`** shows today's numbers: replies, how many used the shape, how many got a check
  line. **`/gentle off`** turns the shape off for the rest of a session and **`/gentle on`**
  brings it back. The switch goes to Claude as a note in the conversation, so the system prompt
  and the prompt cache stay as they were.

## The research behind the shape

No study has tested chat-reply layouts on comprehension. The shape follows what web-reading,
learning and ADHD reading research does show:

- **Answer first.** Most readers scan headings and first words, then stop
  ([NN/g, F-pattern](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/);
  [inverted pyramid](https://www.nngroup.com/articles/inverted-pyramid/)).
- **About four things at once.** Working memory holds about four chunks
  ([Cowan 2001](https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/magical-number-4-in-shortterm-memory-a-reconsideration-of-mental-storage-capacity/44023F1147D4A1D44BDC0AD226838496)),
  and extra memory load cut reading comprehension more in children with ADHD
  ([study](https://pmc.ncbi.nlm.nih.gov/articles/PMC6301149)).
- **One stage at a time.** In a randomised study of 210 adults, about half with ADHD, short
  guidance at each stage of reading closed the comprehension gap that mind-wandering opened
  ([Brann and Sidi 2024](https://cris.openu.ac.il/en/publications/metacognitive-scaffolding-for-digital-reading-and-mind-wandering-/)).
- **Headings that say the point, bold only for the decision**
  ([signaling meta-analysis](https://rex.libraries.wsu.edu/esploro/outputs/journalArticle/A-meta-analysis-of-signaling-principle-in/99900601052901842);
  [W3C cognitive accessibility](https://www.w3.org/TR/coga-usable/)).
- **Left out on purpose:** Bionic Reading showed no gain in a test with 1,916 readers
  ([Readwise](https://blog.readwise.io/bionic-reading-results/)), "ADHD fonts" have no trial, and
  emoji bullets slow reading down
  ([eye tracking](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1631967/full)).
- **Longer feels better, but isn't clearer.** In public chatbot votes, answer length sways people
  about eight times more than lists, headings or bold
  ([LMSYS](https://www.lmsys.org/blog/2024-08-28-style-control)).

## Tested on real replies

The rule was tested on 21 real final replies from one heavy user's Claude Code sessions in one
evening (21 Oct 2026). Each reply was rewritten from the rule alone. A second model then listed
every fact in the original and checked it against the rewrite.

- 748 facts: 724 stayed in the reply, 17 moved to notes (all reference lists), 3 were lost and 4
  changed meaning.
- 62 of the 66 things the user had to decide or do landed under Your call. The misses were soft
  offers such as "you can delete it", and the rule now covers them. So does the one lost
  ranking ("which two of the five matter most").
- The shape does not make replies shorter: 7,717 words became 8,124. What changes is the order.
- On the same replies, the check stayed silent on all 21 rewrites and flagged 15 of the 21
  originals, every one of them over 250 words.

## Install

The plugin needs a Claude Code version with function-hook plugins, which are early access. It
was built and tested on Claude Code 2.1.299.

From a terminal:

```bash
claude plugin marketplace add A-rdit/gentle-replies
claude plugin install gentle-replies@gentle-replies
```

Or inside a Claude Code session in the terminal:

```
/plugin marketplace add A-rdit/gentle-replies
/plugin install gentle-replies@gentle-replies
```

Then copy the rule from [`rules/CLAUDE.md`](rules/CLAUDE.md) into `~/.claude/CLAUDE.md`. Sessions
that are already open keep their old instructions; `/calm` works there anyway, since it tells
Claude to read the rule first.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `check` | `true` | Show the check line under replies. |
| `longWords` | `250` | A reply this long or longer should use the shape. |

Change them with `/plugin configure gentle-replies@gentle-replies` in a terminal session.

## Limits

- The check reads the reply's text, not its meaning. It knows a question by its question mark
  and a changed file by its name, so a reply can pass and still describe a change wrongly.
- Failed commands go by whether the command failed. A piped command such as `npm test | tail`
  reports the last program's result, so a failing run behind a pipe counts as a success.
- The check line shows only in that session's own window.
- `/gentle` keeps its numbers on your machine, for the last 60 days.

## Development

```bash
claude plugin validate plugin
claude plugin test plugin
```

The tests in `plugin/tests` cover the shape check, questions outside Your call, unnamed changed
files, failed commands, skipped turns, `/gentle` and `/calm`.

## Works well with

[Session Guardian](https://github.com/A-rdit/session-guardian), which keeps long sessions cheap
to run and easy to pick up again. Its optional TLDR rule is not needed with this one: the lead
line and Your call do that job.

## License

MIT
