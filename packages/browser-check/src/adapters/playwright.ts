import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Console, Effect, FileSystem } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { chromium } from "playwright";
import { BrowserCheckError } from "#BrowserCheckError.ts";
import { liveNotes } from "./liveNotes.ts";

function attempt<A>(run: () => Promise<A>) {
	return Effect.tryPromise({
		catch: (cause) => new BrowserCheckError({ message: String(cause) }),
		try: run,
	});
}

export const playwright = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const open = Effect.gen(function* () {
		if (yield* fs.exists(chromium.executablePath())) {
			yield* Console.log("browser-check: reusing cached Chromium.");
		} else {
			yield* Console.log("browser-check: installing Chromium on first run; pnpm install does not download browsers.");
			const cli = join(dirname(createRequire(import.meta.url).resolve("playwright/package.json")), "cli.js");
			const child = yield* spawner.spawn(ChildProcess.make("node", [cli, "install", "chromium"], { stderr: "inherit", stdout: "inherit" }));
			const code = Number(yield* child.exitCode);
			if (code !== 0) {
				return yield* new BrowserCheckError({ message: "Chromium installation failed." });
			}
		}
		const browser = yield* Effect.acquireRelease(
			attempt(() => chromium.launch()),
			(acquired) => Effect.promise(() => acquired.close()),
		);
		const context = yield* attempt(() => browser.newContext({ viewport: { height: 900, width: 1440 } }));
		const page = yield* attempt(() => context.newPage());
		page.setDefaultTimeout(5000);
		return {
			checkLiveNotes: (url: string, folder: string) => attempt(() => liveNotes(context, page, url, folder)),
			checkText: (text: string) =>
				attempt(async () => {
					await page.getByText(text, { exact: false }).first().waitFor({ state: "visible" });
				}),
			screenshot: (path: string) =>
				attempt(async () => {
					await page.screenshot({ fullPage: true, path });
				}),
			signIn: (url: string, email: string, password: string) =>
				attempt(async () => {
					const response = await context.request.post(url, { data: { email, password }, headers: { origin: new URL(url).origin } });
					if (!response.ok()) {
						throw new Error(`Test-user sign-in returned HTTP ${response.status()}.`);
					}
				}),
			visit: (url: string) =>
				attempt(async () => {
					const response = await page.goto(url);
					if (response === null || !response.ok()) {
						throw new Error(`Page ${url} returned HTTP ${response?.status() ?? "no response"}.`);
					}
				}),
		};
	});
	return { open: open.pipe(Effect.mapError((cause) => new BrowserCheckError({ message: String(cause) }))) };
});
