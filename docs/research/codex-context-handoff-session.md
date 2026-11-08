## Session handoff — 2026-11-08

### Current scope and instructions

- The Builder's latest scope is **feasibility test only; no new prototype or UI redesign**. This overrides the prototype-building instructions in the original brief below. Keep the ticket open and labelled `wayfinder:prototype` until the Builder supplies observations and chooses an interaction.
- Read `AGENTS.md` and `GLOSSARY.md` in the checkout. Use the defined words exactly. The Builder alone performs UI/host QA; do not open or operate the UI to verify it. Do not install packages; give commands instead.
- The Builder explicitly authorized committing all 28 pending files in coherent commits, overriding the earlier no-commit instruction for that batch. Those five commits are complete. Do not treat that exception as blanket authorization for future implementation commits or for pushing/publishing.
- No production plugin implementation, release, rename, or additional decision ticket has been authorized. The broader map is [Wayfinder: bring Fledgy to Codex under a new name](https://github.com/AlexandreDeMoura/fledgy/issues/9). Resolve at most this one decision in a session. Do not close it on documentation or mocked behavior alone.
- The separate Chrome-extension effort is in `.scratch/chrome-extension-qa/map.md`; do not mix it into this experiment.

### Completed and reported status

- [Establish how Codex plugins can support this product](https://github.com/AlexandreDeMoura/fledgy/issues/11) is closed with general platform research. Reuse it rather than repeating the whole investigation.
- The Builder reported **“I have added the plugin”** on the first computer. Exact installation steps, stdio launch, sidebar rendering, bridge capabilities, draft transfer, and agent responses were **not reported**. Do not infer a host pass from that statement.
- All 28 pending files were committed in five coherent commits on `main`:
  - `545a521` — web-view navigation and local presentation assets.
  - `1a6d010` — Chrome-extension planning map.
  - `ef09358` — existing standalone Codex design prototype and launcher.
  - `49d78a8` — general Codex integration research.
  - `9b20f2f` — context-handoff feasibility experiment and findings.
- The checkout was clean before this handoff. Local `origin/main` pointed at the same commit as `main`; the agent did not push. On the second computer, fetch/pull and confirm `9b20f2f` is present before testing.
- Validation: `npm test` passed **170 tests** with local loopback access. Its sandboxed attempt failed because local test servers could not bind (`EPERM`). The combined prototype/experiment Node suite passed **9 tests**. No UI or real-host integration was verified.

### Assets to read

- [Focused feasibility findings](https://github.com/AlexandreDeMoura/fledgy/blob/9b20f2f/docs/research/codex-context-handoff.md).
- [Complete manual host procedure and fixture limits](https://github.com/AlexandreDeMoura/fledgy/blob/9b20f2f/experiments/codex-context-handoff/README.md).
- [General plugin support research](https://github.com/AlexandreDeMoura/fledgy/blob/9b20f2f/docs/research/codex-plugin-support.md).
- [Earlier built-in-browser analysis](https://github.com/AlexandreDeMoura/fledgy/blob/9b20f2f/docs/research/codex-web-view.md).
- [Existing design prototype](https://github.com/AlexandreDeMoura/fledgy/blob/9b20f2f/prototypes/codex-plugin/README.md). It uses fictional nuée data and simulated chat, and proves no host integration. Do not extend it for the current test-only scope.

### Evidence and decision boundary

The documented candidate is MCP Apps `ui/message` with:
```json
{
  "role": "user",
  "content": [{"type": "text", "text": "<selection snapshot and question>"}],
  "_meta": {"openai/message": {"target": "new", "send": false}}
}
```

This requests an editable unsent host draft. The message must include the selection directly: an earlier `ui/update-model-context` attachment from the sidebar is not guaranteed to follow into a new conversation. Active requests from a global entrypoint use that entrypoint's own thread, not necessarily the previously selected Codex project conversation. The inspected options offer no repository/cwd, mode/model, or explicit thread-ID selector. Observe the actual destination.

No supported API for rendering a real Codex transcript inside the plugin's own floating chat was established. A native conversation beside a thread-entrypoint panel is a documented alternative; `ui/message` acknowledgements are not agent answers. Do not invent `createThread`, `openThread`, or chat-prefill URL schemes. Manual copy/paste is a separate fallback.

Primary sources: [official extensions](https://developers.openai.com/plugins/build/extensions), [pinned extension specification](https://github.com/openai/mcp-extensions/blob/39f91ad0bdf1435aadb879172ab2467d0e97cead/docs/spec.md#prompt-target-and-send-behavior). Research date: 2026-11-08. The first-party DevDay baseline is desktop `26.928.20710`; advertised runtime capabilities still determine availability. The earlier inventory reported desktop `26.1023.51421` (build `22530`), CLI `0.149.1`, and Node `v24.20.0` on the first computer. Record the second computer's actual versions; do not assume they match.

### Resume on another computer

The same ChatGPT account alone does not supply this local plugin's files or Node server. Make the checkout available there, with Node 20+ and a Codex CLI supporting local marketplaces. From the repository root run:

```sh
codex plugin marketplace add "$PWD/experiments/codex-context-handoff"
```

Restart the desktop app. In Plugins, choose **Fledgy feasibility tests**, install/enable **context-handoff-test**, and start a fresh **local Codex** conversation. This fixture needs no npm install, API key, or independent model service. The marketplace root is the experiment folder and its source path is `./`. If the host cannot find Node, use `command -v node` and set that absolute executable as the fixture's `mcp.json` command; refresh/restart. See [official local installation](https://developers.openai.com/plugins/build/plugins#install-a-local-plugin-manually).

Open **Context handoff test** from the sidebar. If no sidebar entry appears, record the failure separately; asking “Use context-handoff-test to open its diagnostic” tests a tool-rendered surface instead.

### Next action and observations needed

The Builder follows the linked manual procedure. Record results in the research note or this ticket description:

1. Desktop product/version/build, OS, local execution, mode, and project/checkout; discovery and stdio launch.
2. Returned `hostInfo`, UI protocol, and relevant capability fields: `message.text`, `experimental["openai/message"]`, and `updateModelContext.text`. No arbitrary host-context or authentication dump.
3. Select the first two fictional Steps. Compare the preview's browser-generated random marker with the new editable draft. It must include selection and question and remain **unsent**. Observe whether it opens in Codex/Chat/Work and which checkout accompanies it.
4. The Builder reviews and sends. A real response must reproduce the marker and identify the selected Steps. Ask a follow-up in the native chat. Return to the fixture, change selection, and repeat; also try highlighted text.
5. Separately open a thread-entrypoint panel in a known Codex conversation. Test the active editable draft and attach/change/clear context operations. Earlier submitted messages remain in history after clearing attachments.
6. Record missing capabilities, errors, timeouts, return/remount behavior, and whether context is stale. Inspect the host before retrying a timed-out draft, since it may already exist.

Correct fictional context does not prove access to the app's Knowledge base or code. This fixture has no repository access, network server, persisted QA Results, or History store. Its stdio server negotiates MCP `2025-11-25`; UI initialization uses `2026-01-26`. A handshake rejection requires compatibility work or an SDK-based retest, not an “impossible” verdict. Acknowledgements alone are insufficient; no canned replies are used.

Once observations exist, recommend embedded conversation, native conversation with context, manual fallback, or no supported path yet. Record the resolution on this ticket, then update the map's decision index and inform the first-release/UI decisions. Do not resolve those downstream tickets in the same session.

Optional non-UI checks:
```sh
node --test prototypes/codex-plugin/*.test.mjs experiments/codex-context-handoff/server.test.mjs
npm test
```

To refresh the installed fixture: `codex plugin marketplace upgrade fledgy-feasibility`, restart, and use a new conversation. To remove it, uninstall the plugin, then run `codex plugin marketplace remove fledgy-feasibility`.
