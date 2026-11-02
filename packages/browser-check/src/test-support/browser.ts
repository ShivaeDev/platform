import { basename, dirname, join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { chromium } from "playwright";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type CliRun, runCli } from "#test/runCli.ts";
import { type SignIn, startHost } from "#test/startHost.ts";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const PREFIX = "browser-check: ";

export const browser = storyKit({
	clock: "live",
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "browser-check-story-" });
		const host = yield* startHost;
		const run: { browserCache?: string; credentials: SignIn | undefined; last: CliRun | undefined } = { credentials: undefined, last: undefined };
		return { host, root, run };
	},
	inspect: ({ host, run }) => ({ output: run.last, signIns: host.signIns, visits: host.visits }),
	layer: NodeServices.layer,
	name: "local browser check",
	stages: ["environment"],
	verbs: ({ host, root, run }, story) => {
		function inWords(line: string) {
			return line.replaceAll(host.url, "the app");
		}
		function finished() {
			return run.last === undefined ? Effect.die(new Error("Run the check before reading its result")) : Effect.succeed(run.last);
		}
		function reported({ stderr, stdout }: CliRun) {
			return `${stdout}\n${stderr}`
				.split("\n")
				.filter((line) => line.startsWith(PREFIX))
				.map((line) => inWords(line.slice(PREFIX.length)));
		}
		return {
			browserActivity: () => Effect.map(finished(), (result) => reported(result).filter((line) => line.includes("Chromium"))),
			checks: (...args: readonly string[]) => {
				story.tell(`browser-check looks at the running app with ${args.join(" ")}`);
				return Effect.map(runCli(root, host.url, args, run.credentials, run.browserCache), (result) => {
					run.last = result;
				});
			},
			checksAt: (url: string, ...args: readonly string[]) => {
				story.tell(`browser-check looks at ${url} with ${args.join(" ")}`);
				return Effect.map(runCli(root, url, args, run.credentials, run.browserCache), (result) => {
					run.last = result;
				});
			},
			outcome: () =>
				Effect.map(finished(), (result) => {
					if (result.code === 0) {
						return "passed";
					}
					const failure = reported({ ...result, stdout: "" }).at(-1);
					return `failed: ${failure ?? `exit code ${result.code} without a browser-check error`}`;
				}),
			pagesVisited: () => Effect.sync(() => [...host.visits]),
			screenshots: () =>
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const folder = join(root, ".browser-check");
					const files = (yield* fs.exists(folder)) ? (yield* fs.readDirectory(folder)).sort() : [];
					return yield* Effect.forEach(files, (file) =>
						Effect.map(fs.readFile(join(folder, file)), (bytes) =>
							PNG_SIGNATURE.every((byte, index) => bytes[index] === byte) ? `${file}: a PNG image` : `${file}: not a PNG image`,
						),
					);
				}),
			signIns: () => Effect.sync(() => host.signIns.map(({ email, password }) => `${email} with password ${password}`)),
			smokeChecks: () => Effect.map(finished(), (result) => reported(result).filter((line) => line.startsWith("smoke passed"))),
		};
	},
});

export function aliceCredentialsSet() {
	return browser.trait("environment", "alice's test-user email and password are set in the environment", ({ run }) => {
		run.credentials = { email: "alice@example.com", password: "alice-password" };
	});
}

export function onlyFullChromiumCached() {
	return browser.trait("environment", "the cache contains full Chromium but no headless shell", ({ root, run }) =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			let installation = dirname(chromium.executablePath());
			while (!basename(installation).startsWith("chromium-")) {
				const parent = dirname(installation);
				if (parent === installation) {
					return yield* Effect.die(new Error("Expected a Playwright Chromium installation"));
				}
				installation = parent;
			}
			run.browserCache = join(root, "browser-cache");
			yield* fs.makeDirectory(run.browserCache);
			yield* fs.symlink(installation, join(run.browserCache, basename(installation)));
		}),
	);
}
