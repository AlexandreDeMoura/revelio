# Driving the extension in real VS Code from an agent's shell

For end-to-end checks of the extension, run from a coding agent's terminal (macOS, VS Code in `/Applications`).

1. Remove every `ELECTRON_*` and `VSCODE_*` variable from the environment before launching `/Applications/Visual Studio Code.app/Contents/MacOS/Code`. An agent's shell inside VS Code inherits `ELECTRON_RUN_AS_NODE=1`, which makes the binary run as plain Node ("bad option"), and `VSCODE_IPC_HOOK`, which can attach to the Builder's own VS Code window.
2. Keep `--user-data-dir` short: the `<dir>/1.xx-main.sock` socket path must stay under 103 characters, so a scratchpad path is too long. `packages/vscode-extension/dist/vsc` works (git-ignored). Delete it afterwards.
3. Add `--remote-debugging-port=<port> --extensions-dir=<scratch dir> --disable-extensions --extensionDevelopmentPath=<abs path to packages/vscode-extension> --new-window <folder to open>`. Open a folder that has a `knowledge-base/`, such as this repo when it's dogfooded or `../auxilia`.
4. Connect with `playwright-core`'s `chromium.connectOverCDP('http://localhost:<port>')`. It isn't a project dependency: install it in a scratch folder. The Revelio view doesn't open by itself, so run **Revelio: Open** from the Command Palette in the workbench page. The page's content is in one of `page.frames()`: find the one containing `#root`.

Build first (`npm run build`), since the host loads `dist/extension.js`.
