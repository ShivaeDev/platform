import { Context, Data, Deferred, Effect, Stream } from "effect";
import { defineService } from "#defineService.ts";
import { genericMethod } from "#genericMethod.ts";

export class Greeting extends Context.Service<Greeting, string>()("story/Greeting") {}
export class CallerFailure extends Data.TaggedError("CallerFailure")<{ readonly number: number }> {}
export class CallerNumber extends Context.Service<CallerNumber, number>()("story/CallerNumber") {}

class InitializationFailure extends Data.TaggedError("InitializationFailure")<{ readonly message: string }> {}
class MethodFailure extends Data.TaggedError("MethodFailure")<{ readonly message: string }> {}

const INITIALIZER_RESOURCE = "the initializer's resource";
const CALL_RESOURCE = "the call's resource";

export type Initialization = "succeeds" | "fails after acquiring its resource" | "waits after acquiring its resource";

export type CountingMethod = "count" | "fail" | "crash";

export interface Recorder {
	initialization: Initialization;
	readonly initializerAcquired: Deferred.Deferred<void>;
	initializerRuns: number;
	methodBuilds: number;
	readonly released: string[];
	readonly resourceHeld: Deferred.Deferred<void>;
}

function release(engine: Recorder, resource: string) {
	return Effect.sync(() => {
		engine.released.push(resource);
	});
}

export function counterService(engine: Recorder) {
	return defineService({
		id: "story/Counter",
		initialize: Effect.gen(function* () {
			engine.initializerRuns += 1;
			yield* Effect.acquireRelease(Effect.void, () => release(engine, INITIALIZER_RESOURCE));
			yield* Deferred.succeed(engine.initializerAcquired, undefined);
			if (engine.initialization === "fails after acquiring its resource") {
				return yield* new InitializationFailure({ message: "initialization failure" });
			}
			if (engine.initialization === "waits after acquiring its resource") {
				return yield* Effect.never;
			}
			return { count: 0 };
		}),
		methods: (state) => {
			engine.methodBuilds += 1;
			function counted() {
				state.count += 1;
				return state.count;
			}
			return {
				count: () => Effect.sync(counted),
				crash: () => Effect.sync(counted).pipe(Effect.andThen(Effect.die(new Error("method defect")))),
				fail: () => Effect.sync(counted).pipe(Effect.andThen(Effect.fail(new MethodFailure({ message: "method failure" })))),
				greet: () => Effect.service(Greeting),
				greetings: () => Effect.map(Greeting, (bound) => Stream.map(Stream.fromEffect(Greeting), (caller) => `${bound}: ${caller}`)),
				hold: () =>
					Effect.acquireRelease(Effect.void, () => release(engine, CALL_RESOURCE)).pipe(
						Effect.andThen(Deferred.succeed(engine.resourceHeld, undefined)),
						Effect.andThen(Effect.never),
					),
				open: () => Effect.acquireRelease(Effect.succeed(CALL_RESOURCE), (resource) => release(engine, resource)),
			};
		},
		requires: [Greeting],
	});
}

function wrap<TSuccess, TFailure, TRequirements>(
	effect: Effect.Effect<TSuccess, TFailure, TRequirements>,
): Effect.Effect<{ readonly value: TSuccess }, TFailure, TRequirements> {
	return Effect.map(effect, (value) => ({ value }));
}

export function wrapperService() {
	return defineService({
		id: "story/Wrapper",
		initialize: Effect.service(Greeting),
		methods: (greeting) => ({
			wrap: genericMethod(<A, E, R>(effect: Effect.Effect<A, E, R>) => wrap(effect).pipe(Effect.map(({ value }) => ({ greeting, value })))),
		}),
		requires: [Greeting],
	});
}
