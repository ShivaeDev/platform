import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { Clock, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { GitHub as GitHubClient } from "@shivaedev/github/GitHub.ts";
import { GitHub } from "@shivaedev/pr-watch/GitHub.ts";
import { GitHubHttp } from "@shivaedev/pr-watch/GitHubHttp.ts";
import { requestFailure } from "@shivaedev/pr-watch/requestFailure.ts";
import { StateFile } from "@shivaedev/pr-watch/StateFile.ts";
import { Watcher } from "@shivaedev/pr-watch/Watcher.ts";
import { githubToken } from "#host/githubToken.ts";

type Report = (number: number, message: string) => Effect.Effect<void>;

const prGitHub = Effect.fn("FleetWatch.prGitHub")(function* (report: Report) {
	const client = yield* GitHub;
	const retryAt = new Map<number, number>();
	const reported = new Set<string>();
	function isolate<A, E>(number: number, read: Effect.Effect<A, E>) {
		return read.pipe(
			Effect.catch((error) =>
				Effect.gen(function* () {
					const failure = requestFailure(error);
					if (!failure.retryable) {
						retryAt.set(number, (yield* Clock.currentTimeMillis) + 5 * 60_000);
					}
					const key = `${number}:${failure.message}`;
					if (!reported.has(key)) {
						yield* report(number, failure.message);
						reported.add(key);
					}
					return undefined;
				}),
			),
		);
	}
	return {
		...client,
		confirmQueue: (options, snapshot) => isolate(snapshot.number, client.confirmQueue(options, snapshot)),
		discover: (options) =>
			Effect.gen(function* () {
				yield* client.discover(options);
				return [...options.numbers];
			}),
		snapshot: (options, number, queue) =>
			Effect.gen(function* () {
				if ((retryAt.get(number) ?? 0) > (yield* Clock.currentTimeMillis)) {
					return undefined;
				}
				return yield* isolate(number, client.snapshot(options, number, queue));
			}),
	} satisfies typeof GitHub.Service;
});

export function watchPrLayer(report: Report) {
	const github = Layer.effect(GitHub)(prGitHub(report)).pipe(Layer.provide(GitHub.layer));
	return Watcher.layer.pipe(
		Layer.provide(Layer.merge(StateFile.layer, github)),
		Layer.provide(GitHubHttp.layer.pipe(Layer.provide(GitHubClient.layer), Layer.provide(githubToken))),
		Layer.provide(
			Layer.merge(NodeFileSystem.layer, FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.RequestInit)({ redirect: "error" })))),
		),
	);
}
