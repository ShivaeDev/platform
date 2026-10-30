import { Cause, Context, Data, Deferred, Effect, Exit, type Fiber, Layer, Option, Scope } from "effect";
import { defineService } from "#defineService.ts";
import { genericMethod } from "#genericMethod.ts";

export class Greeting extends Context.Service<Greeting, string>()("story/Greeting") {}
export class CallerNumber extends Context.Service<CallerNumber, number>()("story/CallerNumber") {}

class InitializationFailure extends Data.TaggedError("InitializationFailure")<{ readonly message: string }> {}
class MethodFailure extends Data.TaggedError("MethodFailure")<{ readonly message: string }> {}

const INITIALIZER_RESOURCE = "the initializer's resource";
const CALL_RESOURCE = "the call's resource";

export type Initialization = "succeeds" | "fails after acquiring its resource" | "waits after acquiring its resource";

export type CountingMethod = "count" | "fail" | "crash";

interface Recorder {
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

function counterService(engine: Recorder) {
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

function wrapperService() {
	return defineService({
		id: "story/Wrapper",
		initialize: Effect.service(Greeting),
		methods: (greeting) => ({
			wrap: genericMethod(<A, E, R>(effect: Effect.Effect<A, E, R>) => wrap(effect).pipe(Effect.map(({ value }) => ({ greeting, value })))),
		}),
		requires: [Greeting],
	});
}

type CounterService = ReturnType<typeof counterService>;
type WrapperService = ReturnType<typeof wrapperService>;

export interface ServiceEngine extends Recorder {
	readonly answers: unknown[];
	build: Fiber.Fiber<unknown, unknown> | undefined;
	buildExit: Exit.Exit<unknown, unknown> | undefined;
	built: Context.Context<Context.Service.Identifier<CounterService> | Context.Service.Identifier<WrapperService>> | undefined;
	call: Fiber.Fiber<unknown, unknown> | undefined;
	callerScope: Scope.Closeable | undefined;
	readonly counter: CounterService;
	readonly layerScope: Scope.Closeable;
	owner: Fiber.Fiber<unknown, unknown> | undefined;
	readonly wrapper: WrapperService;
}

export function* serviceEngine(): Effect.fn.Return<ServiceEngine, never, Scope.Scope> {
	const recorder: Recorder = {
		initialization: "succeeds",
		initializerAcquired: yield* Deferred.make<void>(),
		initializerRuns: 0,
		methodBuilds: 0,
		released: [],
		resourceHeld: yield* Deferred.make<void>(),
	};
	return Object.assign(recorder, {
		answers: [],
		build: undefined,
		buildExit: undefined,
		built: undefined,
		call: undefined,
		callerScope: undefined,
		counter: counterService(recorder),
		layerScope: yield* Scope.fork(yield* Effect.scope),
		owner: undefined,
		wrapper: wrapperService(),
	});
}

export function serviceLayer(engine: ServiceEngine, greeting: string) {
	return Layer.merge(engine.counter.layer, engine.wrapper.layer).pipe(Layer.provide(Layer.succeed(Greeting, greeting)));
}

function built(engine: ServiceEngine) {
	if (engine.built === undefined) {
		return Effect.die(new Error("Declare serviceBuilt() before calling the service"));
	}
	return Effect.succeed(engine.built);
}

export function builtCounter(engine: ServiceEngine) {
	return Effect.map(built(engine), (context) => Context.get(context, engine.counter));
}

export function builtWrapper(engine: ServiceEngine) {
	return Effect.map(built(engine), (context) => Context.get(context, engine.wrapper));
}

export function buildOutcomeOf(exit: Exit.Exit<unknown, unknown> | undefined): unknown {
	if (exit === undefined) {
		return "not finished";
	}
	return Exit.isSuccess(exit) ? "built" : answerOf(exit);
}

export function answerOf(exit: Exit.Exit<unknown, unknown>): unknown {
	if (Exit.isSuccess(exit)) {
		return exit.value;
	}
	if (Cause.hasInterruptsOnly(exit.cause)) {
		return "interrupted";
	}
	const failure = Cause.findErrorOption(exit.cause);
	if (Option.isSome(failure)) {
		return `failed with ${messageOf(failure.value)}`;
	}
	return `died with ${messageOf(Cause.squash(exit.cause))}`;
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
