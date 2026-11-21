# Mapping record

Inventory taken at commit `0ae6452b16d82faece4728fcfdd9989e83ddb22e` (full id): 4 commands, 3 skills, 3 pages, 4 endpoints, 2 incoming events, 3 maintainer scripts.
Pilot: waiting for the Builder

## Areas

| Area | Is | Flows, roughly | Such as | State |
|---|---|---|---|---|
| Setup | Installing Revelio in an app, upgrading it and removing it. | 5 | Install Revelio; Remove Revelio | not gone into |
| Mapping | An agent writing the knowledge base from zero with you, one Area at a time. | 6 | Take the inventory; Write a Flow; Finish the mapping | not gone into |
| Keeping it true | The knowledge base updated and checked after every code change. | 4 | Update the knowledge base after a code change; Check the knowledge base; Agent sent back by a failing check | not gone into |
| Web view | Reading the knowledge base in the browser. | 7 | Open the web view; Read a Flow; See what changed | in progress |
| Manual QA | Following a path's Manual QA Check in the web view and recording how each step went. | 4 | Record a QA Result; Add a note to a QA Step; Reset a path's QA Results | not gone into |
| Maintainer tools | Publishing a new version of Revelio, and trying the web view on a made-up app. | 2 | Release a version; Try the web view on the demo app | not gone into |

## Entry points

An Entry point is a page, an endpoint, a scheduled job or an incoming event: a place where someone or something outside the app starts something in it. Revelio is a command-line tool with Claude Code skills, so its Entry points also include commands, skills and maintainer scripts. It has no scheduled job.

| Kind | Entry point | In | Area | Belongs to |
|---|---|---|---|---|
| command | revelio init (npx revelio-ai init, in the folder with the app's package; --shared is still accepted) | src/cli.ts | Setup | Flow: install-revelio; the rest not looked at yet |
| command | npm init revelio (the create-revelio package, which adds revelio-ai to the app, then runs its init) | packages/create-revelio/cli.js | Setup | Flow: install-revelio, Variants npm-init and npm-init-stops |
| command | revelio uninstall (npx revelio-ai uninstall) | src/cli.ts | Setup | not looked at yet |
| command | revelio check (npx revelio-ai check) | src/cli.ts | Keeping it true | not looked at yet |
| command | revelio view [--port] (npx revelio-ai view) | src/cli.ts | Web view | Flow: open-the-web-view |
| skill | /map-the-app | skills/map-the-app/SKILL.md | Mapping | not looked at yet |
| skill | write-a-flow | skills/write-a-flow/SKILL.md | Mapping | Flow to write: write-a-flow; the rest not looked at yet (also used by Keeping it true when a code change is a whole new Flow: settle when Mapping is gone into) |
| skill | maintain-knowledge-base | skills/maintain-knowledge-base/SKILL.md | Keeping it true | not looked at yet |
| event | Claude Code's Stop event, through revelio stop-hook | src/cli.ts | Keeping it true | not looked at yet |
| page | / (the Overview, with the sidebar every page has) | view/view.js | Web view | Flow: open-the-web-view, Flow to write: search-the-knowledge-base, Flow to write: open-a-flow-to-write, Flow to write: switch-the-theme |
| page | /?page=changes (the Changes) | view/view.js | Web view | Flow to write: see-what-changed |
| page | /?flow=<id> (a Flow's page, tabs "Read the Flow" and "Check by hand") | view/view.js | Web view | Flow: read-a-flow, Flow: see-where-a-part-lives-in-the-code (its "Check by hand" tab is where Manual QA's Flows start: they are listed when Manual QA is gone into) |
| endpoint | GET /api/data | src/view.ts | Web view | Flow: open-the-web-view (every page of the view reads the knowledge base through it) |
| endpoint | POST /api/result | src/view.ts | Manual QA | not looked at yet |
| endpoint | POST /api/note | src/view.ts | Manual QA | not looked at yet |
| endpoint | POST /api/result-reset | src/view.ts | Manual QA | not looked at yet |
| event | A version tag pushed to GitHub | .github/workflows/release.yml | Maintainer tools | not looked at yet (unsure it is an Area of the app rather than Revelio's own housekeeping: settle when Maintainer tools is gone into) |
| script | npm run demo | scripts/demo.mjs | Maintainer tools | not looked at yet |
| script | npm run build (also npm run grammars, and prepack before npm pack) | package.json, scripts/copy-grammars.mjs | | no Flow: a build step for Revelio's developers, no Actor observes an outcome of their own |
| script | npm test | package.json | | no Flow: runs Revelio's automated tests for its developers |
