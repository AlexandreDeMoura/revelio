# Releasing

A release is a version tag pushed to GitHub. The `Release` workflow (`.github/workflows/release.yml`) then publishes the package to npm through trusted publishing: no token, and provenance is added on its own.

The Claude Code plugin and the npm package always use the same version. Keep `version` in `.claude-plugin/plugin.json` and `package.json` in sync with the top-level and root package versions in `package-lock.json`. Include all three files in the release commit before creating the tag.

## Steps

1. **Start from a clean, up-to-date `main`**, and run `npm test`.
2. **Choose the version.** Revelio stays on `0.x`: a patch (`0.1.1`) for fixes and small changes, a minor (`0.2.0`) for new features or anything that breaks how it is used.
3. **Bump it:**
   ```sh
   npm version patch --no-git-tag-version   # or: npm version minor --no-git-tag-version
   ```
   This sets the version in `package.json` and `package-lock.json` without committing or tagging. Then set `version` in `.claude-plugin/plugin.json` to that same version; `npm version` does not update this file.
4. **Review and commit the three version files, then create the tag**, replacing `X.Y.Z` with the chosen version:
   ```sh
   git diff -- package.json package-lock.json .claude-plugin/plugin.json
   git add package.json package-lock.json .claude-plugin/plugin.json
   git commit -m "chore: release X.Y.Z"
   git tag -a vX.Y.Z -m "X.Y.Z"
   ```
   Confirm that all three files use the same release version before committing. The Builder runs the commit and tag commands.
5. **Push the commit and the tag:**
   ```sh
   git push --follow-tags
   gh run watch
   ```
   The workflow installs, checks that the tag matches `package.json`, runs `npm test`, then runs `npm publish`.
6. **Check npm:** `npm view revelio-ai --prefer-online dist-tags` shows the new version as `latest`. Without `--prefer-online`, npm may answer from its cache.
7. **Write the changelog** in GitHub Releases, by hand:
   ```sh
   gh release create vX.Y.Z --title "X.Y.Z" --notes "<what changed, for a Builder>"
   ```

Builders get the new version with `npx revelio-ai@latest init`.

## If something goes wrong

- **The workflow fails before `npm publish`** (tag mismatch, failing test): nothing was published. Delete the tag (`git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`), fix on `main`, then tag again.
- **The workflow fails at `npm publish`**: check on npm whether the version went out. npm never accepts the same version twice, so if it did, release the fix as the next version.
- **CI can't publish at all**: `npm publish` by hand, logged in and with your 2FA code. That version has no provenance.

## `create-revelio`

`packages/create-revelio/` is the small package behind `npm init revelio`. It only runs `npx revelio-ai init`, so a Revelio release does not need a new version of it. It is not part of the `Release` workflow and has its own version, starting at `0.1.0`.

Publish it by hand, only when `packages/create-revelio/` changes:

1. Run `npm test` from the repo root, which also runs its tests.
2. Bump `version` in `packages/create-revelio/package.json`.
3. From `packages/create-revelio/`, check the contents with `npm pack --dry-run`, then run `npm publish`, logged in and with your 2FA code. Versions published this way have no provenance.
4. Check: `npm view create-revelio --prefer-online dist-tags`.
5. Wait a few minutes, then try it: `npm init revelio` in a test repo. Tried too soon after the publish, npm can answer "404 Not Found" for the new tarball and keep answering it for about 5 minutes.

Its **Publishing access** on npmjs.com is "Require two-factor authentication and disallow tokens", like `revelio-ai`. Its `0.0.0-stage` placeholder and staged version stay as they are.

## npm settings that must stay as they are

On npmjs.com, in the package's Settings:

- **Trusted Publisher**: GitHub Actions, owner `AlexandreDeMoura`, repository `revelio`, workflow `release.yml`, no environment, with `npm publish` allowed and not only `npm stage publish`, since the workflow runs `npm publish`. Renaming the workflow file breaks publishing until this is updated.
- **Publishing access**: "Require two-factor authentication and disallow tokens".
- **Staged versions**: `0.0.1-bootstrap` sits in staging since the package was created, next to the public `0.0.0-stage` placeholder npm added then. Never approve it, which would publish it, and never reject it.

## The VS Code extension

`packages/vscode-extension/` is the VS Code extension, `revelio` under the Marketplace publisher `revelio-ai`. It has its own version, starting at `0.0.1`, and is not part of the `Release` workflow. It is not published yet: a removed extension's name can never be used again, so publish it only once it is ready. Until then, `npm run package` in that folder builds a `.vsix` to install by hand (see its `DEVELOPING.md`). Each `npm run package` bumps its patch version, so VS Code sees a reinstall as an update, and that bump is committed with the change. Since nothing is published, these local bumps do not affect a release: choose the version when publishing it for the first time.
