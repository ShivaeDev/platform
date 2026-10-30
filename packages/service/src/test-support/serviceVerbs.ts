import { Effect, Exit, Fiber, Layer, Scope } from "effect";
import {
	answerOf,
	buildOutcomeOf,
	builtCounter,
	builtWrapper,
	CallerNumber,
	type CountingMethod,
	Greeting,
	type ServiceEngine,
	serviceLayer,
} from "./serviceEngine.ts";

function present<TValue>(value: TValue | undefined, missing: string) {
	return value === undefined ? Effect.die(new Error(missing)) : Effect.succeed(value);
}

function interrupted(fiber: Fiber.Fiber<unknown, unknown>) {
	return Effect.andThen(Fiber.interrupt(fiber), Fiber.await(fiber));
}

export function serviceVerbs(engine: ServiceEngine, tell: (line: string) => void) {
	return {
		answers: () => Effect.sync(() => [...engine.answers]),
		build: () =>
			Effect.gen(function* () {
				tell("the caller builds the service's Layer");
				engine.buildExit = yield* Effect.exit(Layer.buildWithScope(serviceLayer(engine, "hello"), engine.layerScope));
			}),
		buildOutcome: () => Effect.sync(() => buildOutcomeOf(engine.buildExit)),
		call: (method: CountingMethod) =>
			Effect.gen(function* () {
				tell(`the caller calls ${method}`);
				const service = yield* builtCounter(engine);
				engine.answers.push(answerOf(yield* Effect.exit(service[method]())));
			}),
		closeCallerScope: () =>
			Effect.gen(function* () {
				tell("the caller closes its scope");
				const scope = yield* present(engine.callerScope, "Declare callOpensResource() before closing the caller's scope");
				yield* closeScope(scope);
			}),
		closeLayer: () => {
			tell("the owner closes the Layer's scope");
			return closeScope(engine.layerScope);
		},
		greet: ({ callerProvides }: { readonly callerProvides?: string } = {}) =>
			Effect.gen(function* () {
				tell(
					callerProvides === undefined
						? "the caller asks for a greeting"
						: `the caller asks for a greeting while providing the greeting "${callerProvides}"`,
				);
				const service = yield* builtCounter(engine);
				return yield* callerProvides === undefined ? service.greet() : service.greet().pipe(Effect.provideService(Greeting, callerProvides));
			}),
		initializerRuns: () => Effect.sync(() => engine.initializerRuns),
		interruptBuild: () =>
			Effect.gen(function* () {
				tell("the owner interrupts the Layer's build");
				const build = yield* present(engine.build, "Declare buildWaitsInInitializer() before interrupting the build");
				engine.buildExit = yield* interrupted(build);
			}),
		interruptCall: () =>
			Effect.gen(function* () {
				tell("the caller interrupts its running call");
				const call = yield* present(engine.call, "Declare callHoldsResource() before interrupting the call");
				engine.answers.push(answerOf(yield* interrupted(call)));
			}),
		interruptOwner: () =>
			Effect.gen(function* () {
				tell("the owner is interrupted");
				const owner = yield* present(engine.owner, "Declare ownerHoldsService() before interrupting the owner");
				yield* interrupted(owner);
			}),
		methodBuilds: () => Effect.sync(() => engine.methodBuilds),
		released: () => Effect.sync(() => [...engine.released]),
		wrapCallersNumber: (number: number) =>
			Effect.gen(function* () {
				tell(`the caller provides the number ${number} and asks the generic method to wrap an effect that reads it`);
				const service = yield* builtWrapper(engine);
				return yield* service.wrap(Effect.service(CallerNumber)).pipe(Effect.provideService(CallerNumber, number));
			}),
	};
}

function closeScope(scope: Scope.Closeable) {
	return Scope.close(scope, Exit.void);
}
