import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Console, Effect, FileSystem, Layer } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { chromium } from "playwright";
import { Browser } from "#Browser.ts";
import { BrowserCheckError } from "#BrowserCheckError.ts";
import { attempt } from "./attempt.ts";
import { pageAdapter } from "./page.ts";

export const playwright = Layer.effect(
	Browser,
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
		const open = Effect.gen(function* () {
			const executablePath = chromium.executablePath();
			if (yield* fs.exists(executablePath)) {
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
				attempt(() => chromium.launch({ executablePath })),
				(acquired) => Effect.promise(() => acquired.close()),
			);
			const context = yield* attempt(() => browser.newContext({ viewport: { height: 900, width: 1440 } }));
			return {
				newPage: attempt(() => context.newPage()).pipe(Effect.map(pageAdapter)),
				signIn: (url: string, email: string, password: string) =>
					attempt(async () => {
						const response = await context.request.post(url, { data: { email, password }, headers: { origin: new URL(url).origin } });
						if (!response.ok()) {
							throw new Error(`Test-user sign-in returned HTTP ${response.status()}.`);
						}
					}),
			};
		});
		return { open: open.pipe(Effect.mapError((cause) => new BrowserCheckError({ message: String(cause) }))) };
	}),
);
