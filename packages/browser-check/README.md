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

Add `"browser-check": "browser-check"` to your package scripts and `.browser-check/` to `.gitignore`. Screenshots go to `.browser-check/1.png`, `.browser-check/2.png` and so on, in page order. Each check clears this output folder before validating its options or starting the browser, so a shorter or failed run leaves only its own captures. Keep this folder dedicated to browser-check output.

`pnpm install` does not download browsers. The first browser-check run announces and installs Chromium through Playwright; later runs announce reuse of the cached browser. On Linux, Playwright's Chromium system libraries must be available on the machine.

To sign in as an existing test user, set `BROWSER_CHECK_EMAIL` and `BROWSER_CHECK_PASSWORD` in your local environment. The command posts to the host's `/api/auth/sign-in/email` Better Auth endpoint and uses the resulting session cookies for the pages. It does not create accounts.

```sh
pnpm browser-check --page /admin --text "Users"
```

## Programmatic use

Compose page checks with the `Browser` service from `@shivaedev/browser-check/Browser.ts` and provide the `playwright` Layer from `@shivaedev/browser-check/adapters/playwright.ts`. Open a scoped session, sign in through its HTTP endpoint when needed, and create pages with `session.newPage`. Pages support visits, text checks and screenshots. Each page shares the session's cookies.

End-to-end browser tests do not belong in an app's CI: they cost CI minutes on private repositories. Prove behavior with stories. Browser check is for looking at the app locally; keep it out of CI and `pnpm ready`/`ci`.

### Pages with live queries

Install `page.watchSocket` before visiting the page, using the exact WebSocket URL to distinguish the app connection from other sockets such as Vite's. It observes the first matching connection and buffers incoming text or binary messages in order. Each `socket.nextMessage` consumes one message, including messages that arrived before the wait began. Receiving the first query result proves that the connection opened and delivered data; an open socket does not prevent navigation from completing.

```ts
import { Effect, Stream } from "effect";
import { Browser } from "@shivaedev/browser-check/Browser.ts";

const inspectLivePage = Effect.gen(function* () {
	const session = yield* (yield* Browser).open;
	const page = yield* session.newPage;
	const socket = yield* page.watchSocket("ws://127.0.0.1:5173/rpc");
	const messages = Stream.fromEffectRepeat(socket.nextMessage);
	const nextResult = messages.pipe(
		Stream.filter((frame) => typeof frame === "string" && frame.includes('"_tag":"Result"')),
		Stream.runHead,
	);
	const nextChange = messages.pipe(
		Stream.filter((frame) => typeof frame === "string" && frame.includes('"_tag":"Changed"')),
		Stream.runHead,
	);
	yield* page.visit("http://127.0.0.1:5173/");
	const firstResult = yield* nextResult;
	return { firstResult, nextChange, page };
});
```

Provide the same Layers as above and keep the session and observer in the caller's scope. Match messages according to your app's protocol; the example selects a Platform query's first result and its later change hints. After an outside action changes the server, consume `nextChange` and check the pushed hint, then use `page.checkText` to confirm the refreshed value reached the screen. No sleep or network-idle wait is needed. A socket error or closure fails pending reads with `BrowserCheckError`; closing the observer's scope removes its listeners. An Effect timeout can bound a missing result, but elapsed time never counts as success.

The live-socket stories are local, on-demand checks against the running starter. They are in the opt-in `slow` project and are not part of the default tests or CI. Start and seed the starter separately with `AUTH_RATE_LIMIT_ENABLED=false` for repeated local sign-ins, then run from the repository root with an existing demo user's credentials:

```sh
BROWSER_CHECK_URL=http://127.0.0.1:5173 \
BROWSER_CHECK_EMAIL=user@demo.test \
BROWSER_CHECK_PASSWORD=local-demo-password \
pnpm --filter @shivaedev/browser-check test src/liveSocket.slow.spec.ts --project slow
```
