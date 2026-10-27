import { NodeServices } from "@effect/platform-node";
import { ConfigProvider, Context, Effect, FileSystem, Layer } from "effect";
import type { Options } from "@shivaedev/pr-watch/model.ts";
import { Watcher } from "@shivaedev/pr-watch/Watcher.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { watchPrLayer } from "#host/watchPrLayer.ts";
import { githubCli } from "#test/githubCli.ts";
import { watchPrApi } from "#test/watchPrApi.ts";

export const prWatchAuthentication = storyKit({
	clock: "live",
	*create() {
		const api = yield* watchPrApi;
		const fs = yield* FileSystem.FileSystem;
		const directory = yield* fs.makeTempDirectoryScoped();
		const options: Options = {
			apiUrl: api.url,
			fleet: true,
			interval: 60_000,
			numbers: [7],
			repository: "example/repository",
			stateFile: `${directory}/state.json`,
		};
		return { api, cli: githubCli(new Map([["token", "fleet-gh-token"]])), options };
	},
	layer: NodeServices.layer,
	name: "Fleet PR watch authentication",
	stages: ["authentication"],
	verbs: (engine, story) => ({
		poll: (watcher: typeof Watcher.Service) =>
			Effect.gen(function* () {
				story.tell("poll the watched pull request");
				const state = yield* watcher.load(engine.options);
				yield* watcher.poll(
					engine.options,
					state,
					() => Effect.void,
					() => Effect.void,
				);
			}),
		requests: engine.api.requests,
		start: (variables: Record<string, string>) => {
			story.tell("start Fleet's PR watcher");
			return Layer.build(
				watchPrLayer(() => Effect.void).pipe(
					Layer.provide(engine.cli.layer),
					Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(variables))),
				),
			).pipe(Effect.map((context) => Context.get(context, Watcher)));
		},
	}),
});

export const signedOut = prWatchAuthentication.trait("authentication", "gh has no signed-in account", (engine) => {
	engine.cli = githubCli(new Map(), 1);
});
