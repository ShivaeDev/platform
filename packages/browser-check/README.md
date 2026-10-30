# @shivaedev/browser-check

See the app you changed. This opt-in local command opens a running app, captures screenshots and runs a few smoke checks so agents and developers can inspect their work.

## Look at your app

```sh
pnpm browser-check --page / --text "Sign in"
```

The screenshot gives you a page to inspect; a visible-text check confirms the expected screen appeared.

## Local use

Start the app separately, then run the command from the app directory. The default host is `http://127.0.0.1:5173`. Use `--url` for another host, repeat `--page` to visit several paths, and repeat `--text` to require visible text on each page. Every page must return a successful HTTP response. A failed smoke check exits unsuccessfully.

```sh
pnpm add -D @shivaedev/browser-check
```

Add `"browser-check": "browser-check"` to your package scripts and `.browser-check/` to `.gitignore`. Screenshots go to `.browser-check/1.png`, `.browser-check/2.png` and so on, in page order, replacing previous captures.

`pnpm install` does not download browsers. The first browser-check run announces and installs Chromium through Playwright; later runs announce reuse of the cached browser. On Linux, Playwright's Chromium system libraries must be available on the machine.

To sign in as an existing test user, set `BROWSER_CHECK_EMAIL` and `BROWSER_CHECK_PASSWORD` in your local environment. The command posts to the host's `/api/auth/sign-in/email` Better Auth endpoint and uses the resulting session cookies for the pages. It does not create accounts.

```sh
pnpm browser-check --page /admin --text "Users"
```

## Check the starter's live notes

With the starter running, use an existing disposable account:

```sh
export BROWSER_CHECK_EMAIL=browser@example.com
export BROWSER_CHECK_PASSWORD=your-test-password
pnpm browser-check --live-notes
```

This mode uses the starter's notes UI at `/`. Two Chromium tabs share the signed-in session cookies. It creates a uniquely named note in the first tab and requires a `Changed` hint and a `notes.list` reread on the second tab's `/rpc` WebSocket, plus the rendered note without navigation. It then signs out in the first tab and requires the second tab's original RPC socket to close, its private note to disappear and its sign-in prompt to appear. The first tab must reach the sign-in screen. A failed check exits unsuccessfully.

Inspect `.browser-check/live-notes.png` and `.browser-check/signed-out.png`. The check leaves its note in the disposable account and revokes the check's session. `--url` also works against the built starter served by `pnpm start`. This smoke check covers Chromium with awake tabs; it does not prove tab sleep, other browsers or deployment infrastructure.

End-to-end browser tests do not belong in an app's CI: they cost CI minutes on private repositories. Prove behavior with stories. Browser check is for looking at the app locally; keep it out of CI and `pnpm ready`/`ci`.
