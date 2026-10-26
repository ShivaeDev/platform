import { Context, Deferred, Effect, Exit, Fiber, Layer, Scope } from "effect";
import type { lifetimeEngine } from "./serviceEngine.ts";

type LifetimeEngine = ReturnType<typeof lifetimeEngine> extends Generator<unknown, infer TEngine, never> ? TEngine : never;
type LiveService = Context.Service.Shape<LifetimeEngine["service"]>;

export function lifetimeVerbs(engine: LifetimeEngine, tell: (line: string) => void) {
	return {
		build: () =>
			Effect.gen(function* () {
				tell("the caller builds the service Layer in its scope");
				return Context.get(yield* Layer.buildWithScope(engine.layer, engine.scope), engine.service);
			}),
		close: () => {
			tell("the owner closes the service Layer scope");
			return Scope.close(engine.scope, Exit.void);
		},
		interrupt: <A, E>(fiber: Fiber.Fiber<A, E>) =>
			Effect.gen(function* () {
				tell("the caller interrupts the fiber and awaits its exit");
				yield* Fiber.interrupt(fiber);
				return yield* Fiber.await(fiber);
			}),
		read: (service: LiveService) => {
			tell("the caller reads from the live service");
			return service.read();
		},
		startInitialization: () =>
			Effect.gen(function* () {
				tell("the owner starts the service Layer initialization");
				const fiber = yield* Effect.scoped(Layer.build(engine.layer)).pipe(Effect.forkChild);
				yield* Deferred.await(engine.started);
				return fiber;
			}),
		startMethod: (service: LiveService) =>
			Effect.gen(function* () {
				tell("the caller starts a method that holds a scoped resource");
				const fiber = yield* Effect.scoped(service.wait()).pipe(Effect.forkChild);
				yield* Deferred.await(engine.acquired);
				return fiber;
			}),
		startOwner: () =>
			Effect.gen(function* () {
				tell("the owner builds and holds the live service Layer");
				const live = yield* Deferred.make<void>();
				const fiber = yield* Effect.gen(function* () {
					const service = yield* engine.service;
					yield* service.read();
					yield* Deferred.succeed(live, undefined);
					return yield* Effect.never;
				}).pipe(Effect.provide(engine.layer), Effect.forkChild);
				yield* Deferred.await(live);
				return fiber;
			}),
	};
}
