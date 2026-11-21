# Plan: the Overview as a map or a list

Status: planned, not started. Written on 19 November 2026. Card: [#17](https://github.com/AlexandreDeMoura/revelio/issues/17).

This plan replaces the Overview of commit `4d13206` with the design's two variants: a **map** of the app and a **list** of it. The design is in the canvas "Revelio VS Code extension" (`https://claude.ai/code/artifact/ac7760c4-4690-4a34-9445-bc0f041d8aa3`), artboards `MapOverview`, `MapNow`, `MapAfter`, `MapInIDE`, `ListNow`, `ListAfter` and `ListInIDE`. `MapOverview.dc.html` holds both views: its `view` tweak picks map or list, and its `stage` tweak plays a mapping session (before, live, after).

Words follow `GLOSSARY.md`. Where the design says "mapped" ("4 of 9 Flows are mapped"), the view says "written", as the glossary does.

## What the Builder sees

The page has, from top to bottom:

1. **The toolbar**, as today: `<app> › Overview`, the search, **Overview** (current), **Changes**.
2. **The header.** "Your app, in plain words", the app's name, "**N of M Flows** are written. K more are waiting to be written.", and a bar with one segment per Flow: written (filled), new (blue, see milestone 5) and to write (empty). On the right, a **Map | List** switch (`role="group"`, two buttons with `aria-pressed`). The view keeps the choice through VS Code's saved state, as it keeps the Flow shown.
3. **The map or the list**, in one framed panel that starts with a **status line** and ends with a **legend**.
4. **Two cards**: **What to map next** and **Happening now**.

### The status line

A dot and a heading, then one line of text. With what the view knows today, it says **Live** with a green dot and "Watching knowledge-base/. Changes show up here the moment they are saved." The design's **Mapping now** state, in blue with a pulsing dot and the agent's latest event, needs to know what the agent is doing: see milestone 6.

### The map

- Each **Area** is a region with rounded corners and a header: its name, then "N of M written".
- Each **Flow** is a dot inside its Area. A written Flow is a filled dot with its name beside it, which opens its Flow page. A **Flow to write** is a dashed ring. Only the Flow to write to start with (below) has a label, with "Start here: a written Flow depends on it". The other Flows to write show their name on hover (`title`).
- Each **Part** a written Flow's Steps name is a small square near that Flow, joined to it by a thin line.
- A **dashed line** joins two Flows when one is "needed before" the other: a precondition of one names the other, written or to write.
- The legend: Flow written, Flow still to write, Part, Needed before.
- Under the panel: "Each region is an Area of your app. Each dot is something a person can do in it. The map fills in by itself as soon as a Flow is saved in knowledge-base/, from the chat or from the terminal."

### The list

One row per Area, open at first, that closes and opens on a click. The Area row shows its name, "N of M written", and a small bar with one segment per Flow. Under it is one row per Flow:

- A **written Flow**: a filled ring, its name, then "<Actor> · needs “<Flow>” first" or "<Actor> · needed before “<Flow>”" when a precondition links it to another Flow. On the right are its Parts as small squares, "N Parts", and an arrow that opens its Flow page.
- A **Flow to write**: a dashed ring and its name, with "Still to write." The one to start with has a **Start here** badge and "Still to write. A written Flow already depends on it." The design groups them as "4 Flows still to write". Since the knowledge base has their names, the list shows each one by name.
- The legend: Flow written, Flow still to write, New, not committed yet (milestone 5), Part.

### What to map next

- First, the Flows to write that written Flows depend on, the most depended on first: the name, "· <Area>", and "Start here: a written Flow already depends on it."
- Then, for each Area with Flows to write left: "N Flows · <Area>", "Still to write."
- **Map it with the agent** puts `/map-the-app` in the agent's prompt, as **Write them with the agent** does today. It then says "Handed to the agent: send it from the chat." until milestone 6 can tell that the agent is working.
- **Check it in the terminal** opens a terminal in the app's folder and runs `git revelio check` there.
- "The agent runs `/map-the-app`. The terminal runs `git revelio check`."

### Happening now

A feed of what changed, newest first, with how long ago. Its heading says "watching knowledge-base/". With nothing changed, it says "Nothing has changed since you opened this view. When the agent or the terminal saves a Flow, it shows up here at once." What it can list, and how close it can come to the design's feed, is milestone 6.

## What goes away

These are only on the current Overview. They go, with their tests, copy and Manual QA lines:

- The **In the last commit** card, and `lastCommit` in the `changes` message (`src/messages.ts`, `src/changes-message.ts` and its two tests).
- **Read it again** and the `readAgain` message (`src/messages.ts`, `src/revelio-panel.ts`).
- The **Still to write** card, the **Areas** section (the list view replaces it) and **Get to know the words**.
- From `to-overview.ts`: `lastCommit`, `areaExamples` and `uncommitted`.

## Milestones

Each milestone is one commit that the Builder can review alone, with its tests written first. Each one names the files it changes.

### 0. Prerequisite, outside this plan: the knowledge base in git

Done on 21 November 2026, in Revelio 0.4.0: the Private install is gone, and the knowledge base is always committed. Milestone 5 needs this, and the other milestones do not. That change also changes `GLOSSARY.md` (Private install, Shared install, History store), `src/init.ts`, the skills and `CLAUDE.local.md`. It is its own plan, [`docs/plans/knowledge-base-in-git.md`](../../../../docs/plans/knowledge-base-in-git.md), on its own card: [#16](https://github.com/AlexandreDeMoura/revelio/issues/16).

With it, `git revelio` goes away. Where this plan says `git revelio check` or `git revelio progress`, read `npx revelio-ai check` or `npx revelio-ai progress`, run in the folder that has the package.

### 1. Remove what goes away

- Files: `src/messages.ts`, `src/changes-message.ts`, `src/changes-message.test.ts`, `src/revelio-panel.ts`, `webview/src/overview-page.tsx`, `webview/src/overview-page.test.tsx`, `webview/src/to-overview.ts`, `webview/src/to-overview.test.ts`, `webview/src/app.tsx`, `webview/src/app.test.tsx`, `webview/src/styles.css` and `DEVELOPING.md`.
- The `changes` message goes back to `{ type, flows }`. `npm run test:integration` runs, since `src/` changes.

### 2. The data: `to-overview.ts`

The page reads one pure shape, tested without a DOM:

```ts
type OverviewFlow = {
  id: string; name: string; actor: string;
  parts: string[];             // ids of the Parts its Steps name, once each
  needs: string[];             // names of the Flows (written or to write) its preconditions name
  neededBy: string[];          // names of the written Flows whose preconditions name it
};
type OverviewFlowToWrite = { id: string; name: string; is: string; dependents: number; startHere: boolean };
type OverviewArea = { id: string; name: string; flows: OverviewFlow[]; toWrite: OverviewFlowToWrite[] };
type Overview = {
  app: string; written: number; toWrite: number;
  areas: OverviewArea[];       // the order of areas.yaml, then the Areas a Flow names that it lacks
  next: { flowsToWrite: (OverviewFlowToWrite & { area: string })[]; areasLeft: { area: string; toWrite: number }[] };
  links: { from: string; to: string }[];   // "needed before", by Flow or Flow-to-write id
};
```

`startHere` marks the Flow to write that the most written Flows depend on. It is the same rule as the web view's Overview (`view/view.js`, `overview()`).

### 3. The list, the header, the cards

- New: `webview/src/overview-list.tsx` and its test. Changed: `overview-page.tsx`, `styles.css`, `host.ts`, which saves `{ flow?, overviewView? }`, and `app.tsx`.
- **Check it in the terminal**: `openTerminal` gets an optional `command`. `src/actions.ts` then calls `terminal.sendText(command)` after `show()`. This is a small protocol change, which the Builder accepted.
- **Happening now**, first version: the webview compares each knowledge base it receives with the one before, and lists "Saved the Flow “X”", "Changed the Flow “X”", "Removed the Flow “X”", "Linked N Parts to “X”" and "Added the Flow to write “X”" with the source "file". It lists only what changed since the view opened, so it starts empty. This needs no protocol change, and milestone 6 adds the agent's and the terminal's events.
- The default view is the map, as in the design, once milestone 4 is done. Until then the switch shows only **List**.

### 4. The map

- New: `webview/src/map-layout.ts`, a pure function from `Overview` to positions, with its test, and `webview/src/overview-map.tsx`.
- **Layout.** The canvas is 716 px wide, the page's content width. It scrolls sideways when the editor is narrower, as the design's map does.
  - **Areas**: a squarified treemap, with each Area weighted by its Flows written plus to write (at least 1). Its height is `max(340, weight × 14000 / 716)` px. The constant is tuned by eye on this repo and on `../auxilia`. With pantry's 7, 1 and 1 Flows, this gives the design's layout: one large region on the left, and two stacked on the right.
  - **Flows**: in a grid inside their region, under the header. The columns are `floor((width − 24) / 170)`, so that a label fits. The written Flows come first, then the Flows to write. A label that does not fit ends with "…" and shows its full name on hover.
  - **Parts**: up to 6 squares on an arc on the free side of their Flow's dot, then "+N". A Part named by several Flows shows near each of them. One shared square with a line to each Flow is truer, but it crowds the map; try it again once there is a real app to judge by.
  - **Needed before**: a dashed line between the two dots.
  - The test checks that every dot is inside its region, that no two dots overlap, that the same input gives the same output, and that the map takes the design's shape with pantry's numbers.
- **Drawing.** One SVG draws the regions, lines, dots and squares (`aria-hidden`). Absolutely positioned HTML draws the labels, so they wrap as in the design. A written Flow's label is a `<button>` that opens its Flow page. The list is the accessible version of the map.
- **Motion.** Colours change over 600 ms, as in the design. The pulse of a Flow being written is a CSS animation. Both stop under `prefers-reduced-motion`.
- **Colours.** These come from the theme variables in `styles.css`, with the design's colours as fallbacks: blue is `--rv-link` and `--rv-accent`, green is `--rv-passed`. Add a token only where none fits, such as the region background.

### 5. "New, not committed yet" (after milestone 0)

- With the knowledge base in git, the extension adds the Flow files that git sees as new (untracked or added) to what it sends. For example, `changes` gains `newFlows: string[]`, read with `git status --porcelain -- knowledge-base/flows`. This is a protocol change.
- The view then shows those Flows in blue, with "New · not committed yet" in the map and a "New · not committed" badge in the list. In the header bar, their segments are blue.
- Open question for the Builder: should a Flow file that is changed but not committed be marked too, for example "Changed · not committed"? The design shows only new Flows.

### 6. The agent's and the terminal's work, live

The research, with its sources, is in [`docs/research/overview-live-activity.md`](../../../../docs/research/overview-live-activity.md). This section is what to build from it.

**How the view knows.** Revelio writes **activity events**, one JSON line each, to `~/.revelio/<first commit>/activity/<session>.jsonl`, beside the QA Results. Events from a terminal go in `terminal.jsonl`. An event holds a time, the checkout, the session, who (`agent`, `stop-hook` or `terminal`) and what happened (`prompt`, `skill`, `read`, `wrote`, `waiting`, `stopped`, `ended`, `progress`, `check`), with file paths from the app's root. It never holds a file's content or a command's text. Three things write events:

1. **Hooks that `init` installs** beside the Stop hook, and that `uninstall` removes: `UserPromptSubmit`, `UserPromptExpansion`, `PostToolUse` on `Read|Write|Edit|Bash|Skill`, `Notification` on `permission_prompt|idle_prompt`, `StopFailure` and `SessionEnd`. Each runs a new command, `revelio activity`, with `async: true`. It appends one line, and it always exits 0 and prints nothing, so it never shows a "hook error" or slows the agent.
2. **`revelio check`** appends its own result, and who ran it (from `CLAUDE_CODE_CHILD_SESSION`). The feed then shows every check: the agent's, the Stop hook's, and the Builder's in any terminal.
3. **A new `revelio progress --area <name> | --flow <id>`**. `map-the-app` runs it once when it settles the Area, and `write-a-flow` once when it names the Flow. `init` adds an allow rule for it, so it asks the Builder nothing.

The extension watches the `activity/` folder, as it watches the QA Results file. While the view is visible and a session of this app seems busy, it also runs `claude agents --json --cwd <app>` every 5 s. That command is Claude Code's documented way to read whether a session is busy, waiting or idle. The poll catches what no hook reports: the Builder pressing Esc, or a window closed. A new message, `{ type: "activity", events, sessions }`, carries all of this to the webview.

**What it gives the page.**

| In the design | Exact? | From |
| --- | --- | --- |
| "Mapping now", with the newest event | Yes | The hooks and the poll |
| "The agent started mapping with /map-the-app" | Yes | `UserPromptExpansion`, or the `Skill` hook |
| "Reading the code behind <Area>", and the Area in blue | Yes, when the skill reports it. Without the report, a file path or a guess | `revelio progress --area`, else the Mapping record's Area in progress, else the Area of the last file read |
| The Flow to write "Being written by the agent" | Yes, when the prompt or the skill names it | `revelio progress --flow`, or the prompt `/map-the-app Write the Flow to write "<name>".` |
| "· Step N", and its bar of N segments | **No**, see the decision below | Nothing before the save |
| "Saved “X” in knowledge-base/", "Linked N Parts to “X”" | Yes | Milestone 3's diff, with the icon from the `Write` hook |
| "git revelio check: Knowledge base check passed.", with the terminal icon | Yes | The check's own event |
| **Map it with the agent** becomes "The agent is mapping in the chat" | Yes | Busy and the last skill was `map-the-app` or `write-a-flow`; back on `stopped`, `ended`, or when the poll says idle |

**Decision for the Builder: "Step N".** The agent writes a Flow file in one action, so nothing can count the Flow's Steps before it is saved. The bar could count the stages of `write-a-flow` instead (read, trace, sort, Parts, write, check), with one `revelio progress` call per stage. But in `GLOSSARY.md` a Step is "one moment in a Flow", and using the word for a stage of the agent's work changes what it means. Choose one:
- Drop "Step N" and its bar, and show "Being written by the agent".
- Count the stages, with a word that is not "Step". This needs a new term in `GLOSSARY.md`.

**Order.** Each item is one commit.

- 6a: `revelio check` writes its event, and the view reads `activity/`. This needs no hook.
- 6b: the `activity` hooks, in `init` and `uninstall`, and the `activity` message.
- 6c: the `claude agents --json` poll.
- 6d: the Area in blue.
- 6e: `revelio progress` in the two skills, with its allow rule.
- 6f: Codex, later. Its hooks can run the same `revelio activity`.

6a, 6b and 6e change the CLI in `src/` and the skills in `skills/`, not only the extension. Since the hooks go where the Stop hook goes, 6b comes after milestone 0.

**To check by hand** (from the research):
- Does `UserPromptExpansion` run in the VS Code chat panel for a `/map-the-app` that Revelio filled in?
- Is the agent slower with an async hook on each `Read` while it reads many files?
- Can the extension host find `claude` on its `PATH` when VS Code starts from the Dock?
- Does the view follow the right session when two sessions, or a linked worktree, work on the same app?
- How often does the agent run `revelio progress` over a real mapping session on `../auxilia`?

## Manual QA, Flows and checks

- Each milestone changes the *Manual QA* section of `DEVELOPING.md` for what it adds or removes. Milestone 1 removes the current Overview's lines.
- The Flow to write "Read a Flow in VS Code" in `knowledge-base/areas.yaml` changes its sentence when the Overview changes. Then `git revelio check` runs.
- Each milestone is checked in headless web VS Code (`docs/e2e-vscode.md`), with screenshots in the Dark Modern theme and in a light theme, and with this repo and `../auxilia` open.
