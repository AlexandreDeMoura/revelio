# Revelio AI

**Understand the app your agent built, without reading its code.**

Revelio keeps a plain-words map of every user flow, the parts of the system each step runs through, and a manual QA script for each path, checked against the code after every change. It is about user flows and manual QA, not a code graph.

Works with Claude Code today. Revelio was called Fledgy until 0.3.0: `npx revelio-ai init` moves a Fledgy install over.

## What it does

- **It explains your system through its user flows.** Each Flow is told from the side of the person using the app: what they do, what they see, what the system does. Each step names the parts of the system it runs through. You understand the app from how it is used, not from its file tree.
- **It tells you what to test, and what to retest.** Every path has a manual QA script you tick in the web view. Your results are tied to the commit you checked them on, so the view shows what changed since.
- **It stays true.** The agent reads the implementation to describe your app and updates those descriptions as it changes the code. Revelio checks that the structure and code references hold together, shows changes since your last QA, and gives you a manual QA script for each described path.

Can the agent misunderstand something? Yes. The automated checks don’t prove the prose correct. I trust today’s coding agents with this work because the process grounds their descriptions in code and puts concrete behavior in front of me to read, question, and try.

## What it won’t do

- Explain or review your code. There are no architecture docs and no code graph.
- Replace your automated tests.
- Serve as your agent’s memory.

## Get started

You need Node 20 or later, Claude Code, and your app in a git repo with a `package.json`.

In the folder with your app's `package.json`, run:

```sh
npm install -D revelio-ai
npx revelio-ai init
```

With pnpm, yarn or bun, add `revelio-ai` as a dev dependency with that tool instead of npm.

Revelio installs in your app, for the whole team: its skills in `.claude/skills/`, a Stop hook in `.claude/settings.json` that checks the knowledge base each time the agent stops, and one line in `CLAUDE.md`. Commit them. Commit the `knowledge-base/` it writes too, with the code it describes.

It then offers to open Claude Code and start mapping. Otherwise, open Claude Code at the repo's root and type `/map-the-app`, or just say *Map the app*. Revelio reads your code, proposes the Areas of your app for you to correct, then writes their Flows with you, one Area at a time, over several sessions.

To read what it writes, run:

```sh
npx revelio-ai view
```

Run each command in the folder with your app's `package.json`:

| Command | What it does |
|---|---|
| `npx revelio-ai view` | Opens the web view of the knowledge base, at http://localhost:4173 |
| `npx revelio-ai check` | Checks the knowledge base's structure and code references |
| `npm install -D revelio-ai@latest`, then `npx revelio-ai init` | Upgrades Revelio |
| `npx revelio-ai uninstall` | Removes Revelio, and keeps your knowledge base |

**Installed Revelio 0.3.0 or before?** It installed for you only, in `.revelio/`, and hid the knowledge base from git. Add `revelio-ai` to the app and run `npx revelio-ai init`, as above: it replaces that install, and git then sees `knowledge-base/`, ready to commit. Your QA results and history are kept.

## Not yet

- Claude Code only.
- Apps with a `package.json`, on macOS or Linux. An app without one, Python only for example, gets one with `npm init -y` at its root. Windows is untested.
- Code references into TypeScript, JavaScript and Python only.
- One person per machine: QA results are not shared.
- The check covers structure, not whether the words are true.
- The token cost of mapping an Area is not measured yet.

## Feedback

Revelio is young, and feedback is the most useful thing you can give it. Report a bug in [Issues](https://github.com/AlexandreDeMoura/revelio/issues). Ask a question, share an idea, or show what you mapped in [Discussions](https://github.com/AlexandreDeMoura/revelio/discussions).

## License

[MIT](LICENSE)
