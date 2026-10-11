import { writeFile } from "node:fs/promises";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { GitHub } from "#GitHub.ts";
import { GitHubHttp } from "#GitHubHttp.ts";
import { StateFile } from "#StateFile.ts";
import { Watcher } from "#Watcher.ts";
import { startServer } from "./server.ts";
export const services = Watcher.layer.pipe(
	Layer.provide(Layer.mergeAll(StateFile.layer, GitHub.layer.pipe(Layer.provide(GitHubHttp.layer)))),
	Layer.provide(
		Layer.mergeAll(
			NodeFileSystem.layer,
			FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.RequestInit)({ redirect: "error" }))),
		),
	),
);
export const { effectApp } = makeEffectIt({
	around: (test) => test.pipe(Effect.provide(Layer.fresh(services))),
	clock: "live",
	layer: services,
	makeHarness: (context) =>
		Effect.gen(function* () {
			const server = yield* Effect.tryPromise({ catch: (cause) => cause, try: startServer });
			context.onTestFinished(server.close);
			const lines: string[] = [];
			const diagnostics: string[] = [];
			function emit(line: string) {
				return Effect.sync(() => {
					lines.push(line);
				});
			}
			function diagnostic(line: string) {
				return Effect.sync(() => {
					diagnostics.push(line);
				});
			}
			const cycle = Effect.gen(function* () {
				const watcher = yield* Watcher;
				const state = yield* watcher.load(server.options);
				return yield* watcher.poll(server.options, state, emit, diagnostic);
			});
			return {
				...server,
				cycle,
				diagnostic,
				diagnostics,
				emit,
				lines,
				restart: cycle.pipe(Effect.provide(Layer.fresh(services))),
				withStateText: (text: string) => Effect.promise(() => writeFile(server.options.stateFile, text)),
			};
		}),
});
