import { NodeServices } from "@effect/platform-node";
import { Context, Effect, FileSystem, Layer } from "effect";
import { fakeGitHub } from "@shivaedev/github/test-support/fakeGitHub.ts";
import type { Options } from "@shivaedev/pr-watch/model.ts";
import { requestFailure } from "@shivaedev/pr-watch/requestFailure.ts";
import { Watcher } from "@shivaedev/pr-watch/Watcher.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { GithubApi } from "#host/githubApi.ts";
import { watchPrLayer } from "#host/watchPrLayer.ts";
import { httpGithubApi } from "#test/githubApi.ts";

const connect = Effect.fnUntraced(function* (remaining: number, tell: (line: string) => void) {
	const github = fakeGitHub({ limit: 10, remaining, reset: 600 });
	const server = yield* github.serve;
	const api = yield* httpGithubApi(server.url);
	const fs = yield* FileSystem.FileSystem;
	const directory = yield* fs.makeTempDirectoryScoped();
	const watchers = new Map<string, typeof Watcher.Service>();
	const poll = Effect.fnUntraced(function* (repository: string) {
		tell(`poll PR events in ${repository}`);
		let watcher = watchers.get(repository);
		if (watcher === undefined) {
			const context = yield* Layer.build(watchPrLayer(() => Effect.void).pipe(Layer.provide(Layer.succeed(GithubApi)(api))));
			watcher = Context.get(context, Watcher);
			watchers.set(repository, watcher);
		}
		const options: Options = {
			apiUrl: server.url,
			fleet: true,
			interval: 1000,
			numbers: [],
			repository,
			stateFile: `${directory}/${repository.replace("/", "-")}.json`,
		};
		const state = yield* watcher.load(options);
		return yield* watcher
			.poll(
				options,
				state,
				() => Effect.void,
				() => Effect.void,
			)
			.pipe(Effect.match({ onFailure: requestFailure, onSuccess: () => "observed" as const }));
	});
	return {
		poll,
		read: (path: string) => {
			tell(`Fleet reads ${path}`);
			return api.get(path).pipe(Effect.map((body): unknown => JSON.parse(body)));
		},
		reply: github.reply,
		requests: () => github.requests.map(({ endpoint, status }) => `${status} ${endpoint}`),
	};
});

export const prWatchBudget = storyKit({
	create: () => ({}),
	layer: NodeServices.layer,
	name: "Fleet PR watch budget",
	stages: [],
	verbs: (_engine, story) => ({ connect: (remaining: number) => connect(remaining, story.tell) }),
});
