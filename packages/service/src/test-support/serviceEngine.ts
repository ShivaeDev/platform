import { Cause, Context, Deferred, Effect, Exit, type Fiber, Layer, Option, Scope, type Stream } from "effect";
import { counterService, Greeting, type Recorder, wrapperService } from "./serviceFixtures.ts";

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
	greetingStream: Stream.Stream<string, never, Greeting> | undefined;
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
		greetingStream: undefined,
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
