import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { chromium } from "playwright";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { liveNotes } from "#adapters/liveNotes.ts";
import { type LiveAppOptions, liveApp } from "./liveApp.ts";

export const liveBrowser = storyKit({
	clock: "live",
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const folder = yield* fs.makeTempDirectoryScoped({ prefix: "browser-check-live-story-" });
		const unhandled: string[] = [];
		function onUnhandled(error: unknown) {
			unhandled.push(String(error));
		}
		yield* Effect.acquireRelease(
			Effect.sync(() => process.on("unhandledRejection", onUnhandled)),
			() =>
				Effect.sync(() => {
					process.off("unhandledRejection", onUnhandled);
				}),
		);
		const browser = yield* Effect.acquireRelease(
			Effect.promise(() => chromium.launch()),
			(opened) => Effect.promise(() => opened.close()),
		);
		const context = yield* Effect.promise(() => browser.newContext());
		const writer = yield* Effect.promise(() => context.newPage());
		writer.setDefaultTimeout(5000);
		const options: LiveAppOptions = { blockAdd: false, brokenNavigation: false, nonRpc: "none" };
		const draft = Promise.withResolvers<void>();
		yield* Effect.promise(() => liveApp(context, options, () => draft.resolve()));
		const run: { failure: string; outcome: string; waiting: Promise<void> | undefined } = { failure: "", outcome: "not run", waiting: undefined };
		function start() {
			run.outcome = "waiting";
			run.waiting = liveNotes(context, writer, "http://browser-check.test", folder).then(
				() => {
					run.outcome = "passed";
				},
				(error) => {
					run.failure = String(error);
					run.outcome = "failed";
				},
			);
		}
		return { context, draft, options, run, start, unhandled };
	},
	inspect: ({ run, unhandled }) => ({ failure: run.failure, outcome: run.outcome, unhandled }),
	layer: NodeServices.layer,
	name: "live browser check",
	stages: ["app"],
	verbs: (engine, story) => ({
		checksLiveNotes: () => {
			story.tell("browser-check verifies the two-tab notes flow");
			return Effect.promise(async () => {
				engine.start();
				await engine.run.waiting;
			});
		},
		closesTabs: () => {
			story.tell("the browser tabs close");
			return Effect.promise(() => engine.context.close());
		},
		outcome: () =>
			Effect.promise(async () => {
				await engine.run.waiting;
				return engine.run.outcome;
			}),
		startsLiveCheck: () => {
			story.tell("browser-check starts verifying the two-tab notes flow");
			return Effect.sync(engine.start);
		},
		unhandledRejections: () =>
			Effect.promise(async () => {
				await new Promise<void>((resolve) => setImmediate(resolve));
				return [...engine.unhandled];
			}),
		waitsForDraft: () => Effect.promise(() => engine.draft.promise),
	}),
});

export function navigationFails() {
	return liveBrowser.trait("app", "the app's navigation fails", ({ options }) => {
		options.brokenNavigation = true;
	});
}

export function addIsBlocked() {
	return liveBrowser.trait("app", "the add button cannot be clicked", ({ options }) => {
		options.blockAdd = true;
	});
}

export function nonRpcFrame(kind: LiveAppOptions["nonRpc"]) {
	return liveBrowser.trait("app", `the app sends ${kind} outside an RPC envelope`, ({ options }) => {
		options.nonRpc = kind;
	});
}
