# create-revelio

Installs [Revelio](https://github.com/AlexandreDeMoura/revelio) in your app. In the app's git repo, run:

```sh
npm init revelio
```

That is the same as `npx revelio-ai@latest init`: a private install, for you only, that git does not see. Run it again later to upgrade.

For a team, install Revelio in the app first, then:

```sh
npm install -D revelio-ai
npm init revelio -- --shared
```

`--shared` runs the Revelio the app depends on, not the latest one. Note the `--` before it: npm keeps whatever comes before `--` for itself.

This package holds no Revelio code. It only runs `revelio-ai init` with the arguments you give it.
