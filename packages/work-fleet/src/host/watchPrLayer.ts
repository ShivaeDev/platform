import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { Clock, Effect, Layer } from "effect";
import { GitHub } from "@shivaedev/pr-watch/GitHub.ts";
import { requestFailure } from "@shivaedev/pr-watch/requestFailure.ts";
import { StateFile } from "@shivaedev/pr-watch/StateFile.ts";
import { Watcher } from "@shivaedev/pr-watch/Watcher.ts";
import { watchPrHttp } from "#host/watchPrHttp.ts";

type Report = (number: number, message: string, retryable: boolean) => Effect.Effect<void>;
interface Observations {
	readonly failure: (error: unknown) => void;
}

const prGitHub = Effect.fn("FleetWatch.prGitHub")(function* (report: Report, observations?: Observations) {
	const client = yield* GitHub;
	const retryAt = new Map<number, number>();
	const reported = new Set<string>();
	function isolate<A, E>(number: number, read: Effect.Effect<A, E>) {
		return read.pipe(
			Effect.catch((error) =>
				Effect.gen(function* () {
					const failure = requestFailure(error);
					if (!failure.retryable && failure.retryAt === undefined) {
						retryAt.set(number, (yield* Clock.currentTimeMillis) + 5 * 60_000);
					}
					const key = `${number}:${failure.message}`;
					if (!reported.has(key)) {
						yield* report(number, failure.message, failure.retryable || failure.retryAt !== undefined);
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
				yield* client.discover(options).pipe(Effect.tapError((error) => Effect.sync(() => observations?.failure(error))));
				return [...options.numbers];
			}),
		queue: (options) => client.queue(options).pipe(Effect.tapError((error) => Effect.sync(() => observations?.failure(error)))),
		snapshot: (options, number, queue) =>
			Effect.gen(function* () {
				if ((retryAt.get(number) ?? 0) > (yield* Clock.currentTimeMillis)) {
					return undefined;
				}
				return yield* isolate(number, client.snapshot(options, number, queue));
			}),
	} satisfies typeof GitHub.Service;
});

export function watchPrLayer(report: Report, observations?: Observations) {
	const github = Layer.effect(GitHub)(prGitHub(report, observations)).pipe(Layer.provide(GitHub.layer));
	return Watcher.layer.pipe(Layer.provide(Layer.merge(StateFile.layer, github)), Layer.provide(watchPrHttp), Layer.provide(NodeFileSystem.layer));
}
