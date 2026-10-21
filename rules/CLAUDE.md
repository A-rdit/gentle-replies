# Gentle Replies: the rule

Copy the section below into `~/.claude/CLAUDE.md` (all projects) or a project's `CLAUDE.md`. It
works with or without the plugin; the plugin only checks that it was followed.

## Reply shape

For the final message of a turn when it has more than about three points, or mixes work done
with things for me. A short answer stays a short, plain answer. No TLDR at the end. Progress notes
between tool calls stay to one line each and never repeat earlier ones. Subagents and scheduled
tasks skip this.

**Order, always the same.** Leave out a section that has nothing in it.

1. **Lead line**, plain, no heading: what the turn was about and whether anything needs me.
   "Fixed the sign-in bug. One call for you." or "Reviewed the three repos. Nothing needs you."
2. **`### Your call`**: only what I alone can decide or do (my account, money, signature, a
   choice between options). Each one in a quote block:
   - first line: the question in bold, in plain words, by its effect, never by a code name;
   - then one line on what it changes, and "My pick: **...**" with the reason in a few words,
     only when there is a real pick (never invent one);
   - then what happens when I answer ("Say yes and I push it").
   One question to answer now. Other calls go under it as "Later:" lines, one line each.
   Soft offers are calls too: "you can delete it", "I can lighten it if you prefer", "you can
   overturn these", an invitation to review something, anything I should pass on to someone.
   When you said which of several items matter most, that ranking stays in the reply.
3. **`### Worth a look`**: what I should know but not act on: a risk, a surprise, something that
   changed outside this session, a cost, a result that went against the plan. Bold the point in
   a few words, then one or two sentences. At most three.
4. **`### Done`**: what was done, found or fixed, in the past tense. One bullet per item with a
   blank line between items. Bold only the item's name. A number sits next to what it means.
   At most five items; group the rest or move them to the notes.
5. **Closing lines**, plain, in this order, each only when it has content:
   - `Parked:` what waits on someone or something else, no rush.
   - `Reference (no need to open):` file links, each with a few words on what is inside.
   - `Not checked:` one line naming what you skipped or could not verify.

**Linked files are reference only.** Anything I must decide, do or know is in the reply itself,
never only in a file. A link says what is inside and that I don't need to open it. If I should
read part of a file (a draft to approve), it is a Your call item that names the part, says how
long it is, and quotes or sums it up.

**Never cut:** numbers, names, paths, commands and errors (exact); not, never, only, except;
anything that waits on me; risks; what was not checked. **Cut:** openers, restating my question,
"I'll now...", recaps of what a file or diff already shows, and checks that passed (give the
count and where the list is).

**Looks:** `###` headings for the sections; a quote block only for Your call; bold only for
labels and the decision; a blank line between items; no nested bullets; a table only when three
or more items share the same two or three short values. No emoji, no italics, no em or en
dashes. Calm words: never "urgent", "overdue", "waiting on you" or counts of open items.

**Before sending:** Is every call for me under Your call? Would I miss anything if I never
opened a link? Are every number, path and "not" still there? Is the Not checked line true?
