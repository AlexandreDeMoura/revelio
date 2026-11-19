# Driving the extension in real VS Code from an agent's shell

For end-to-end checks of the extension, run from a coding agent's terminal (macOS, VS Code in `/Applications`).

The Builder works on the same screen. A desktop VS Code window takes the focus and brings its Space to the front, so check in **headless web VS Code** (below) by default. Use the desktop window (last section) only when the change needs desktop VS Code: a native dialog, `openExternal`, or a key that the browser keeps, such as ⇧⌘P.

Build first (`npm run build`), since the extension host loads `dist/extension.js`. After a rebuild, reload the page.

## Headless web VS Code (default)

VS Code's `code-tunnel serve-web` runs VS Code as a local server, with a normal Node extension host on this computer. Headless Chrome, driven by Playwright, opens it. No window opens.

1. Make a folder in the scratchpad, `$S` below. Link the extension into the server's extensions folder, and turn off the welcome page and the chat panel:

   ```sh
   mkdir -p $S/sw/data/extensions $S/sw/data/data/Machine $S/pw
   ln -sfn <abs path to packages/vscode-extension> $S/sw/data/extensions/revelio-ai.revelio-dev
   echo '{ "workbench.startupEditor": "none", "chat.disableAIFeatures": true }' > $S/sw/data/data/Machine/settings.json
   ```

2. Start the server in the background, with a clean environment. An agent's shell inside VS Code has `ELECTRON_*` and `VSCODE_*` variables that can attach to the Builder's own VS Code. The first run downloads the server, which can take a minute.

   ```sh
   env -i HOME=$HOME PATH=/usr/bin:/bin:/usr/sbin:/sbin \
     "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code-tunnel" serve-web \
     --port 8765 --without-connection-token --accept-server-license-terms --disable-telemetry \
     --server-data-dir $S/sw/data --cli-data-dir $S/sw/cli > $S/sw/log.txt 2>&1 &
   echo $! > $S/sw/pid
   ```

   Wait until `curl -s -o /dev/null -w '%{http_code}' http://localhost:8765/` prints `200`.

3. Install `playwright-core` in `$S/pw` (it isn't a project dependency) and drive the page with headless Chrome. Open a folder that has a `knowledge-base/`, such as this repo when it's dogfooded or `../auxilia`.

   ```js
   import { chromium } from "playwright-core";
   const browser = await chromium.launch({ channel: "chrome", headless: true });
   const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
   await page.goto("http://localhost:8765/?folder=" + encodeURIComponent("<abs path to the folder>"));
   await page.waitForSelector(".monaco-workbench", { timeout: 60_000 });
   await page.waitForTimeout(4000);

   // A new profile opens the folder in Restricted Mode, where the extension is off. Trust it once.
   const restricted = page.locator(".statusbar-item", { hasText: "Restricted Mode" });
   if (await restricted.count()) {
     await restricted.first().click();
     await page.getByRole("button", { name: /^Trust$/ }).first().click();
     await page.waitForTimeout(3000);
     await page.keyboard.press("Escape");
   }

   // F1 opens the Command Palette: the browser keeps ⇧⌘P.
   await page.keyboard.press("F1");
   await page.keyboard.type("Revelio: Open");
   await page.waitForTimeout(800);
   await page.keyboard.press("Enter");

   // The Revelio view's content is in one of page.frames(): find the one containing #root.
   ```

   Look at the result with `page.screenshot()`, and read the screenshot.

4. Stop the server: `kill $(cat $S/sw/pid)`.

## Desktop VS Code window (only when needed)

This window takes the focus on the Builder's screen. Tell the Builder before you open it, and close it as soon as the check is done.

1. Remove every `ELECTRON_*` and `VSCODE_*` variable from the environment before launching `/Applications/Visual Studio Code.app/Contents/MacOS/Code`. An agent's shell inside VS Code inherits `ELECTRON_RUN_AS_NODE=1`, which makes the binary run as plain Node ("bad option"), and `VSCODE_IPC_HOOK`, which can attach to the Builder's own VS Code window.
2. Keep `--user-data-dir` short: the `<dir>/1.xx-main.sock` socket path must stay under 103 characters, so a scratchpad path is too long. `packages/vscode-extension/dist/vsc` works (git-ignored). Delete it afterwards.
3. Add `--remote-debugging-port=<port> --extensions-dir=<scratch dir> --disable-extensions --extensionDevelopmentPath=<abs path to packages/vscode-extension> --new-window <folder to open>`.
4. Connect with `playwright-core`'s `chromium.connectOverCDP('http://localhost:<port>')`. Run **Revelio: Open** from the Command Palette in the workbench page, and find the frame containing `#root`, as above.
