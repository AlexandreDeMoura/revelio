# The Overview, live: what the agent and the terminal are doing

Research checked on 19 November 2026, for milestone 6 of [the Overview plan](../../packages/vscode-extension/docs/plans/overview-map-and-list.md#6-the-agents-and-the-terminals-work-live). Documentation, the installed `@types/vscode` 1.105.0, Claude Code 2.1.308 (CLI) and 2.1.328 (VS Code extension), and Codex CLI 0.149.1 were checked. Nothing was built. [Earlier research](../../agent-integration-research.md) covers sending a prompt to an agent. This file covers watching one.

Today the extension sees only files under `knowledge-base/` change, and fills Claude Code's prompt through `vscode://anthropic.claude-code/open?prompt=`. [Refresh](../../packages/vscode-extension/src/refresh.ts) · [askAgent](../../packages/vscode-extension/src/actions.ts)

## The mechanisms, in short

| Mechanism | What it gives | Cost and limits |
| --- | --- | --- |
| **Claude Code hooks** that append events to a file | Each prompt, skill, file read or written, Bash command, wait for permission, and stop, with `session_id` and `cwd`. No help from the agent is needed. | One short process per event. Hooks run only after workspace trust. Nothing on a user interrupt. |
| **The skills report their progress** with a small command | The Area and the Flow the agent works on, in Revelio's own words, before any file is saved. | Each report is one tool call of the agent: time, tokens, and a permission prompt without an allow rule. The agent can forget it. |
| **The Deterministic Check writes its own result** | Every run of `git revelio check`, and who ran it: the agent, the Stop hook or a terminal. | None found. |
| **`claude agents --json`** | Each live Claude Code session: `cwd`, `sessionId`, `status` busy, waiting or idle. Anthropic documents it as the supported way to read session state. | It does not say what the session is doing. About 0.1 s for each call, so it is polled. |
| **The knowledge base files alone** (planned in milestone 3) | Saved, changed and removed Flows, Parts linked, Flows to write added, Mapping record changes. | Nothing before a save. No busy state. |
| VS Code **terminal shell integration** | Commands typed in VS Code's integrated terminals, with exit code and output. | It does not see the agent's commands or external terminals. |
| Claude Code's **transcript** (`.jsonl`) | Everything. | Its format is not documented as an interface. It lags. It holds secrets. |
| Claude Code's **VS Code extension** | Nothing that can be read. | No API, event or readable state. |

The sections below give the sources.

## 1. The status line, and the Area "the agent is working here"

The design shows "Mapping now · Reading the code behind Meal plan" while the agent works, and "Live · Watching knowledge-base/…" otherwise. The Area the agent works in is shown in blue.

**Whether an agent is working.**

- **Hooks.** `UserPromptSubmit` runs when a prompt is sent, and `Stop` when Claude finishes responding. `StopFailure` runs instead of `Stop` on an API error, and `SessionEnd` runs when a session ends. Every input carries `session_id`, `cwd` and `transcript_path`. [Hook lifecycle](https://code.claude.com/docs/en/hooks#hook-lifecycle) · [Common input fields](https://code.claude.com/docs/en/hooks#common-input-fields) · [StopFailure](https://code.claude.com/docs/en/hooks#stopfailure) · [SessionEnd](https://code.claude.com/docs/en/hooks#sessionend)
- **Limit.** `Stop` "does not run if the stoppage occurred due to a user interrupt". Hooks alone can leave the view saying "Mapping now" after the Builder pressed Esc. [Stop](https://code.claude.com/docs/en/hooks#stop)
- **Waiting for the Builder.** `Notification` runs with `notification_type` `permission_prompt` or `idle_prompt`, among others. In the VS Code extension, `permission_prompt` comes about six seconds after Claude asks. [Notification](https://code.claude.com/docs/en/hooks#notification)
- **`claude agents --json`** prints the live sessions. Each has `cwd`, `kind`, `startedAt`, `sessionId`, `name`, and, while its process lives, `pid` and `status`: `busy`, `waiting` or `idle`. `waitingFor` says why it waits. "`claude agents --json` is the supported way to read session state from outside Claude Code, for example from a status bar". `--cwd <path>` keeps the sessions started under that folder. [List sessions as JSON](https://code.claude.com/docs/en/agent-view#list-sessions-as-json) · [Read session state from a script](https://code.claude.com/docs/en/agent-view#read-session-state-from-a-script) · [CLI reference](https://code.claude.com/docs/en/cli-reference)
  - Checked here: it listed the three sessions that the VS Code extension runs (`entrypoint` `claude-vscode`), this one as `busy`. Each call took 0.11 s. The VS Code extension ships its own binary at `resources/native-binary/claude`, which answers the same command. That path is not documented.
  - It does not say which skill runs, so on its own it cannot tell mapping from other work.
- **Not to use:** `~/.claude/sessions/<pid>.json` also holds a `status`. The documentation describes it only as "one small file per running session, used to detect concurrent sessions and crashes", and says the files under `~/.claude/jobs/` "are not a stable interface". [Application data](https://code.claude.com/docs/en/claude-directory#application-data) · [Read session state from a script](https://code.claude.com/docs/en/agent-view#read-session-state-from-a-script)

**That the work is mapping.**

- When the Builder types `/map-the-app`, `UserPromptExpansion` runs with `command_name` and `command_args`. `UserPromptSubmit` receives the line "as you typed it rather than the expanded skill content". When Claude calls the skill itself, a `PreToolUse` or `PostToolUse` hook on the `Skill` tool runs instead, and typing `/skillname` "bypasses `PreToolUse`". [UserPromptExpansion](https://code.claude.com/docs/en/hooks#userpromptexpansion) · [UserPromptSubmit input](https://code.claude.com/docs/en/hooks#userpromptsubmit-input)
- The Skill tool's input names the skill in a `skill` field, as the tool's schema in this session shows. The hooks reference does not document that field.

**Which Area.**

- **The skill can say it.** `map-the-app` knows the Area at step 2 of `area.md` ("Settle the Area"). One report there names it exactly. [area.md](../../skills/map-the-app/area.md)
- **The Mapping record says it roughly.** An Area whose State is `list to correct` or `in progress` is the one a session works in. That is true between sessions too, so it is shown as the agent's Area only while a mapping session is busy. [The Mapping record](../../skills/map-the-app/SKILL.md#the-mapping-record)
- **Hooks can guess it.** `Read` gives `tool_input.file_path`, always absolute. A file that is the `In` of an Entry point in the Mapping record, or that an Anchor of a Part points to, belongs to a known Area. The other files on the trace match nothing. [PreToolUse input](https://code.claude.com/docs/en/hooks#pretooluse-input)
- Files added with `@` in the prompt fire no tool hook. [PreToolUse](https://code.claude.com/docs/en/hooks#pretooluse)

"Reading the code behind Meal plan" can be exact with one report from the skill. With hooks alone it is "Reading `web/src/app/meal-plan/page.tsx`", or a guess when the file is known.

## 2. The Flow to write "Being written by the agent · Step N", before it is saved

- **Which Flow.** `write-a-flow` settles the Flow and its id at step 2, "Name the Flow". A report there gives the Flow to write's id before any file is written. [write-a-flow](../../skills/write-a-flow/SKILL.md)
  - When the Builder clicks a named Flow to write, the prompt `/map-the-app Write the Flow to write "<name>".` already names it, and `UserPromptExpansion` gives that line. In the other sessions, the agent picks the next Flow itself.
- **Just before the save.** A `PreToolUse` hook on `Write` gets the whole new file in `tool_input.content`. The Flow file is written at step 7 of `write-a-flow`, in one call, a moment before the watcher sees it. [PreToolUse input](https://code.claude.com/docs/en/hooks#pretooluse-input)
- **"Step N of M" has no event to come from.** In the design it counts three segments, then "Saved". If it counts the Steps of the Flow, they exist only in the agent's reasoning until the one `Write`. If it counts the stages of `write-a-flow` (read, trace, sort, Parts, write, check), only the skill can report them, one tool call each. In `GLOSSARY.md` a **Step** is "one moment in a Flow", so using it for a stage of the agent's work changes what the word means. Revelio needs a decision here, not a new word from this research.
- **Rejected:** have the agent save the Flow file after each Step. A half-written Flow fails the Deterministic Check, and the view would show it.
- **Codex.** The same report from the skill works. Codex hooks see `apply_patch`, matched as `Edit` or `Write`. [Codex hooks](https://learn.chatgpt.com/docs/hooks)

## 3. "Happening now", event by event and source by source

| Event in the design | Source icon | Exact from | Also possible |
| --- | --- | --- | --- |
| "The agent started mapping with /map-the-app" | chat | `UserPromptExpansion` (`command_name`), or the `Skill` tool hook | `claude agents --json` going `busy`, without the skill |
| "Reading the code behind Meal plan" | chat | A skill report that names the Area | `Read` hooks, as a file path or a guessed Area |
| "Writing the Flow “X” · Step 1/2/3" | chat | Skill reports (see 2) | `PreToolUse` on the `Write` of `knowledge-base/flows/X.yaml`, just before the save |
| "Saved “X” in knowledge-base/" | file | The watcher, diffing two reads (milestone 3) | `PostToolUse` on `Write` says the agent wrote it, so the icon can be chat |
| "Linked 2 Parts to “X”" | chat | The diff: the Parts the Flow's Steps name | `Write` and `Edit` hooks on `knowledge-base/parts/` |
| "git revelio check: Knowledge base check passed." | terminal | The check writes its own result (see 5) | `PostToolUse` on `Bash` (`tool_response.stdout`), shell integration |

- **Order and time.** Hooks with `"async": true` do not block Claude, but "Each execution creates a separate background process". Two events can land out of order, so each one carries the time it was made and the view sorts them. [Run hooks in the background](https://code.claude.com/docs/en/hooks#run-hooks-in-the-background) · [Limitations](https://code.claude.com/docs/en/hooks#limitations)
- **What goes in the file.** The input of `Write` holds the file's content, and the input of `Bash` holds the command, which can hold a secret. The event keeps only a path from the app's root, the tool, and Revelio's own commands.
- **Subagents.** Their tool calls fire the same hooks, with `agent_id` and `agent_type`. [Hook locations](https://code.claude.com/docs/en/hooks#hook-locations)

## 4. "Map it with the agent" becomes "The agent is mapping in the chat"

- **Busy and mapping**: a session whose `cwd` is in the app is busy, and the last skill it started is `map-the-app` or `write-a-flow`. Hooks give both at once.
- **Back to the button**: on `Stop`, `StopFailure` or `SessionEnd`, or when `claude agents --json` no longer shows that session `busy` or `waiting`. The poll catches the user interrupt, which runs no hook, and a closed window.
- **Waiting**: `Notification` `permission_prompt`, or `status` `waiting` with `waitingFor`, can say "The agent is waiting for you in the chat".
- **Several sessions.** Every event carries `session_id`, and `claude agents --json` lists each session. The view follows the newest busy mapping session of this checkout. Linked worktrees share the app's folder in `~/.revelio/` (it is named after the first commit), so events are filtered by checkout. [App data folder](../../src/qa-results.ts)
- **The Claude Code VS Code extension gives nothing to read.** Version 2.1.328 contributes only commands that act on its UI (open, focus, new conversation, accept a diff…). Its URI handler takes `/open` and `/install-plugin`. Its `activate` returns no API, and the context keys it sets are about layout. Checked in the installed `package.json` and `extension.js`. Its documentation names no event or API for other extensions. [Claude Code in VS Code](https://code.claude.com/docs/en/vs-code)
- Settings, hooks included, are shared between the extension and the CLI, so hooks that `init` writes run in the chat panel too. [VS Code settings](https://code.claude.com/docs/en/vs-code)

## 5. The terminal's check

- **Shell integration** gives `window.onDidStartTerminalShellExecution` and `onDidEndTerminalShellExecution`, with `execution.commandLine.value`, its `confidence`, `cwd`, `read()` (raw output, escape sequences included, from the first call to `read`), and `exitCode`. These are in `@types/vscode` 1.105.0, here, and have been available since VS Code 1.93. [Shell execution API](https://code.visualstudio.com/api/references/vscode-api#TerminalShellExecution) · [vscode.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.d.ts) · [VS Code 1.93](https://code.visualstudio.com/updates/v1_93)
  - It runs only in VS Code's integrated terminals where integration is active: automatic for bash, fish, pwsh and zsh on macOS and Linux, and Git Bash and pwsh on Windows. It is not automatic for Command Prompt, sub-shells, plain `ssh` or "complex shell setups". [Shell integration](https://code.visualstudio.com/docs/terminal/shell-integration) · [Terminal.shellIntegration](https://code.visualstudio.com/api/references/vscode-api#Terminal)
  - `exitCode` can be `undefined`, for example after Ctrl+C.
  - It does not see the agent's commands: Claude Code's Bash tool runs its own subprocess, not a VS Code terminal. A `claude` or `codex` CLI that runs in a VS Code terminal is one long execution. External terminals are not seen.
- **The check writes its result.** `revelio check` already prints "Knowledge base check passed." or the problems. It can also append that result where the view reads its events. It then shows every run: the agent's, the Builder's in any terminal, and the Stop hook's. [check](../../src/cli.ts) · [Stop hook](../../src/stop-hook.ts)
  - Who ran it: Claude Code sets `CLAUDE_CODE_CHILD_SESSION=1` and `CLAUDE_CODE_SESSION_ID` in the subprocesses of its Bash tool and hooks, and not in a terminal the Builder opened. `CLAUDECODE=1` is set in IDE terminals too, so it cannot tell them apart. [Environment variables](https://code.claude.com/docs/en/env-vars)
- **Comparison.** The check's own record sees every run and costs nothing. Shell integration sees only the Builder's runs in VS Code. It is still useful for **Check it in the terminal**: `shellIntegration.executeCommand` returns the execution of that one command. [TerminalShellIntegration](https://code.visualstudio.com/api/references/vscode-api#TerminalShellIntegration)

## 6. The mechanisms in detail

### Claude Code hooks

- **Where.** `init` already writes a `Stop` hook to `.claude/settings.local.json` (Private install) or `.claude/settings.json` (Shared install). The binary is found through `git rev-parse --show-toplevel`, and `uninstall` removes the hook. More events fit in the same settings. Hooks can also live in a plugin's `hooks/hooks.json` or in a skill's frontmatter. [init](../../src/init.ts) · [Hook locations](https://code.claude.com/docs/en/hooks#hook-locations)
- **Skill frontmatter hooks** register "when you or Claude invoke the skill" and keep running "for the rest of the session". They would cost nothing in sessions that never map. But the skills are copied as they are, and their command cannot know where the install put the binary. [Hooks in skills and agents](https://code.claude.com/docs/en/hooks#hooks-in-skills-and-agents) · [copySkills](../../src/init.ts)
- **Matchers.** `Read|Write|Edit|Bash|Skill` limits the tool events. `if` narrows them further with permission rule syntax. [Matcher patterns](https://code.claude.com/docs/en/hooks#matcher-patterns) · [Common fields](https://code.claude.com/docs/en/hooks#common-fields)
- **Input.** `PostToolUse` adds `tool_response` and `duration_ms`. For `Bash` the response has `stdout` and `stderr`, and `PostToolUseFailure` has `error`, which starts with "Exit code N". [PostToolUse input](https://code.claude.com/docs/en/hooks#posttooluse-input) · [PostToolUseFailure input](https://code.claude.com/docs/en/hooks#posttoolusefailure-input)
- **Timing and cost.** A command hook blocks until it ends unless `async: true`. Async results are not shown to the Builder. Here, starting Node took 0.02 s and the private install's `revelio` binary 0.05 s. [Run hooks in the background](https://code.claude.com/docs/en/hooks#run-hooks-in-the-background)
- **Failure.** Exit 0 is success. Exit 2 blocks, and for `Stop` it sends the agent back. Any other code is a non-blocking error, and Claude Code shows a "hook error" notice, for a missing binary too. The event command must always exit 0 and print nothing. [Exit code output](https://code.claude.com/docs/en/hooks#exit-code-output) · [Other exit codes](https://code.claude.com/docs/en/hooks#other-exit-codes)
- **Trust.** In an interactive session, Claude Code holds back every hook until the workspace trust dialog is accepted. [Workspace trust](https://code.claude.com/docs/en/hooks#workspace-trust)
- **HTTP hooks** POST the same JSON to a URL. A fixed port clashes between VS Code windows, and nothing listens while VS Code is closed. A file needs no server and keeps the events. [HTTP hook fields](https://code.claude.com/docs/en/hooks#http-hook-fields)
- **Seen on this computer.** Another VS Code extension, Agent Arcade, writes the same kind of hooks to `.claude/settings.local.json`: one JSON file per event in its own storage folder, written beside it, then moved in place.

### The skills reporting progress

- A skill can run a command. `map-the-app` already tells the agent to run "the check command in your instructions, with `view` in place of `check`". The same form works for `progress`. [area.md, step 7](../../skills/map-the-app/area.md)
- **Reliability.** No published measure was found of how often an agent follows such a line. Anthropic presents hooks as "deterministic control: certain actions always happen rather than relying on the LLM to choose to run them". Revelio already pairs its instruction line with a Stop hook for the same reason. [Hooks guide](https://code.claude.com/docs/en/hooks-guide) · [Stop hook](../../src/stop-hook.ts)
- **Cost.** Each report is one more tool call. Without an allow rule, each one asks the Builder for permission. A rule such as `Bash(git revelio progress *)` allows it. A skill's `allowed-tools` lasts only for "the turn that invokes this skill", and a mapping session has many turns. [Permission rule syntax](https://code.claude.com/docs/en/permissions#wildcard-patterns) · [Skill frontmatter](https://code.claude.com/docs/en/skills#frontmatter-reference)
- A missed report must only make the view less precise. The hooks and the files still show the work.
- Anthropic suggests the same thing for background sessions: "If you want a session to report progress in its own words, have it write a file of its own". [Read session state from a script](https://code.claude.com/docs/en/agent-view#read-session-state-from-a-script)

### The transcript

- It is at `~/.claude/projects/<project>/<session>.jsonl`, and `transcript_path` in every hook input gives it. It is "written asynchronously and may lag". Hooks should use `last_assistant_message` instead. [Application data](https://code.claude.com/docs/en/claude-directory#application-data) · [Common input fields](https://code.claude.com/docs/en/hooks#common-input-fields)
- Its format is not documented. The documented readers are the Agent SDK's `listSessions()` and `getSessionMessages()`. A transcript here holds 17 kinds of lines, most of them internal (`api-request`, `file-history-delta`, `cost-state`…). [Agent SDK sessions](https://code.claude.com/docs/en/agent-sdk/sessions)
- It holds file contents and command output, unencrypted. [Plaintext storage](https://code.claude.com/docs/en/claude-directory#application-data)
- **Not recommended.** Everything it would give, hooks give in a documented form.

### Codex

- **Hooks**: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `Interrupt`, `SessionEnd` and more, with `session_id`, `turn_id`, `cwd` and `transcript_path`. Tool hooks cover shell commands (as `Bash`), `apply_patch` (as `Edit` or `Write`) and MCP tools. Codex has no `Read` tool, so a file read is a shell command to parse. `Interrupt` covers what Claude Code's `Stop` misses. [Codex hooks](https://learn.chatgpt.com/docs/hooks)
- **Trust**: a hook runs only once trusted, and trust is tied to its hash, so "new or changed hooks are skipped until trusted". If the hook's command line stays the same across Revelio versions, the trust is kept. [Codex hooks](https://learn.chatgpt.com/docs/hooks)
- **`notify`** runs a program only on `agent-turn-complete`, with `thread-id`, `turn-id`, `cwd` and `last-assistant-message`. That is only the end of a turn. [Codex notifications](https://learn.chatgpt.com/docs/config-file/config-advanced)
- **App Server** sends `turn/started`, `turn/completed`, `item/started`, `item/completed` and `thread/status/changed` to a connection subscribed to a thread. The documentation does not say that a third client can watch a thread that the IDE extension or the terminal runs. `codex agents` opens a browser of sessions and has no JSON output. [Codex App Server](https://learn.chatgpt.com/docs/app-server) · [Earlier research](../../agent-integration-research.md#reach-an-agent-already-running-in-a-terminal)
- The skill's progress command and the check's own record work the same with Codex.

### The knowledge base files alone

Milestone 3 already plans this fallback: diff two reads of the knowledge base. [The Overview plan, milestone 3](../../packages/vscode-extension/docs/plans/overview-map-and-list.md#3-the-list-the-header-the-cards)

- **It can show**: a Flow saved, changed or removed, Parts linked, a Flow to write added or gone, and, from the Mapping record, an Area that becomes `list to correct`, `in progress` or `done`. The Stop hook saves a Knowledge base version in the History store at each stop, which says that a turn ended. [History](../../src/history.ts)
- **It cannot show**: that the agent is working, reading code, the Flow being written before its save, any Step N, the check, or who wrote a file.

## Recommendation

### The design

**One event folder, with three writers.** Each event is one line of JSON in `~/.revelio/<first commit>/activity/<session>.jsonl`, next to the QA Results and the History store. Events from a terminal go in `terminal.jsonl`. It is outside the app, so nothing is committed, and it works for both installs.

```json
{"v":1,"at":"2026-11-19T15:02:11.204Z","checkout":"/Users/me/pantry","session":"0c9e…","by":"agent","event":"read","file":"web/src/app/meal-plan/page.tsx"}
```

`event` is one of:

- `prompt`: with `skill` and `args` when it is a Revelio skill
- `skill`
- `read`, `wrote`: with the file's path from the app's root
- `waiting`: with `for`
- `stopped`, `ended`
- `progress`: with `area`, `flow`, and the stage if one is decided
- `check`: with `passed`, `problems`, and `by`, which is `agent`, `stop-hook` or `terminal`

No file content or command text goes in, apart from Revelio's own commands. A writer drops session files older than a day.

1. **Hooks that `init` installs**, beside the Stop hook and removed by `uninstall`, with the same way to find the binary:
   - Events: `UserPromptSubmit`, `UserPromptExpansion`, `PostToolUse` with the matcher `Read|Write|Edit|Bash|Skill`, `Notification` with `permission_prompt|idle_prompt`, `StopFailure` and `SessionEnd`.
   - Each one runs `revelio activity`, with `async: true`. It reads stdin, keeps only the fields above, appends one line, and always exits 0 without output.
   - The Stop hook stays synchronous, and appends `stopped` and its `check`.
2. **`revelio check`** appends its own `check`, with `by` taken from `CLAUDE_CODE_CHILD_SESSION` and the session from `CLAUDE_CODE_SESSION_ID`.
3. **`revelio progress --area <name>` and `--flow <id>`**:
   - `map-the-app` reports once, when it settles the Area.
   - `write-a-flow` reports once, when it names the Flow.
   - `init` adds an allow rule for it.

**What the extension watches.**

- The `activity/` folder, with its own watcher, as it watches the QA Results file. It reads only the new lines of each file. [QA Results watcher](../../packages/vscode-extension/src/qa-results-watch.ts)
- While the view is visible and a session in this checkout is thought to be busy or waiting, it runs `claude agents --json --cwd <app>` every 5 s, to catch an interrupt or a closed session. It finds `claude` on the `PATH`, else in the Claude Code extension's folder.
- The knowledge base, as today, diffed as milestone 3 plans.

**What the webview shows.** A new message, for example `{ type: "activity", events, sessions }`, sent when the folder changes or the poll changes something.

- **Status line**: "Mapping now" and the newest event of the busy mapping session. Otherwise "Live".
- **Area in blue**: the reported Area, else the Mapping record's Area `in progress` or `list to correct`, else the Area of the last file read when it is known.
- **The Flow to write being written**: the reported Flow, or the one named in the prompt, until its file is saved.
- **"Happening now"**: the events, merged with the file diffs, newest first, with the source icon from `by` and "Ns ago".
- **The button**: "The agent is mapping in the chat" while busy and mapping, "waiting for you" on `waiting`, and the button again on `stopped` or `ended`, or when the poll says idle.

### What matches the design, and what does not

- **Exact:**
  - "The agent started mapping with /map-the-app"
  - Saved
  - Linked N Parts
  - The check, with who ran it
  - The busy button, with the poll covering interrupts
  - The Flow being written when the prompt or the skill names it
- **Exact only with the skill's report:** "Reading the code behind <Area>" and the Area in blue. Without it, a file path or a guess.
- **Not possible as drawn:** "Step N of M" before the save. Nothing counts the Flow's Steps before its single `Write`. Counting the stages of `write-a-flow` needs one report per stage, and a decision on the word, since a Step is a moment in a Flow.

### The order to build it in

1. **The check writes its result**, and the view reads `activity/`. The feed gets the check from every source, beside milestone 3's file events. This needs no hook.
2. **The `activity` hooks, through `init` and `uninstall`**, and the `activity` message. This gives the status line, the busy button, "started mapping", the files read and written, and the icons.
3. **The `claude agents --json` poll**, to repair the busy state.
4. **The Area in blue**, from the Mapping record and the files read.
5. **`revelio progress`** in `map-the-app` and `write-a-flow`, with the allow rule. It gives the exact Area and the Flow being written.
6. **Codex**: the same `activity` command behind its hooks, once Codex support is decided.

### Risks to check by hand

- Does `UserPromptExpansion` run in the VS Code chat panel when the Builder sends `/map-the-app` that Revelio filled in? Does a `Skill` hook run when `map-the-app` starts `write-a-flow`?
- Is Claude Code slower with an async hook on every `Read`, `Write`, `Edit` and `Bash`, during a burst of reads at the inventory?
- Do the "hook error" notices appear when the binary is missing, for example after `.revelio/` was deleted by hand? The command must then do nothing.
- Can the extension host run `claude agents --json`? Check its `PATH` when VS Code starts from the Dock, the bundled binary when the CLI is not installed, and a CLI version that differs from the extension's.
- Before the workspace trust dialog is accepted, no hook runs. The view must still say "Live", not "Mapping now".
- With two sessions in the same app, and with a linked worktree of the same app, does the view follow the right session?
- Milestone 0 plans to remove the Private install. The hooks must follow wherever the Stop hook goes.
- How often does the agent run `revelio progress` when told to, over a real mapping session on `../auxilia`?
