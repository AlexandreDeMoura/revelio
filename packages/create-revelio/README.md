# create-revelio

Installs [Revelio](https://github.com/AlexandreDeMoura/revelio) in your app. In the folder with your app's `package.json`, run:

```sh
npm init revelio
```

That is the same as `npm install -D --save-exact revelio-ai@latest`, then `npx revelio-ai init`. Commit what it adds, and the `knowledge-base/` Revelio writes, with your code. Run it again later to upgrade.

It runs npm only. In an app that uses pnpm, yarn or bun, it writes nothing and prints the two commands for that tool.

This package holds no Revelio code. It only adds `revelio-ai` to your app, then runs its `init` with the arguments you give it.
