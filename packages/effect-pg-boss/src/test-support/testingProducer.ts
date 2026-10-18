import { Deferred, Effect, Option } from "effect";
import type { SendOptions } from "pg-boss";
import type { clientEngine } from "#test/clientEngine.ts";
import { pgBossRuntime } from "#test/pgBossRuntime.ts";
import type { testingEngine } from "#test/testingEngine.ts";

type TestingState = ReturnType<typeof testingEngine> extends Generator<unknown, infer A, never> ? A : never;
type State = ReturnType<typeof clientEngine> & { testingState: TestingState };

export function* testingProducer(state: State) {
	const testing = state.testingState;
	if (!testing.enabled) {
		return;
	}
	const runtime = yield* pgBossRuntime(state, () => undefined).boot([testing.queue], {
		clientCacheKey: testing.clientCacheKey,
		clientFactory: (options) => {
			const client = testing.testing.clientFactory(options);
			testing.client = Option.some(client);
			return client;
		},
		schema: "story_jobs",
		supervise: false,
	});
	testing.jobs = Option.some(runtime.jobs);
}

export function* testingWorker(state: State) {
	const testing = state.testingState;
	if (!(testing.enabled && testing.worker)) {
		return;
	}
	const worker = testing.queue.handle(({ id }) => {
		testing.attempts.push(id);
		return testing.paused
			? Deferred.succeed(testing.entered, undefined).pipe(Effect.andThen(Deferred.await(testing.release)))
			: Effect.fail(new Error("The worker fails this attempt"));
	});
	const runtime = yield* pgBossRuntime(state, () => undefined).boot([worker], {
		clientCacheKey: testing.clientCacheKey,
		clientFactory: testing.testing.clientFactory,
		schema: "story_jobs",
		supervise: false,
	});
	testing.jobs = Option.some(runtime.jobs);
}

export function testingVerbs(state: TestingState) {
	return {
		attempts: state.attempts,
		queue: state.queue,
		releaseWorker: Deferred.succeed(state.release, undefined),
		send: (id: number, options?: SendOptions) => Option.getOrThrow(state.jobs).enqueue(state.queue, { id }, options),
		testing: state.testing,
		testingClient: () => Option.getOrThrow(state.client),
		workerStarted: Deferred.await(state.entered),
	};
}
