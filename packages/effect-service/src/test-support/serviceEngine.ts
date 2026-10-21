import { Context, Data, Deferred, Effect, Layer, Scope } from "effect";
import { defineService } from "#defineService.ts";
import { genericMethod } from "#genericMethod.ts";
import type { ServiceRequirements } from "#ServiceRequirements.ts";

export class Declared extends Context.Service<Declared, { readonly identity: object; readonly prefix: string }>()("story/Declared") {}
export class Caller extends Context.Service<Caller, { readonly value: number }>()("story/Caller") {}

export function serviceCounts() {
	return { factoryCalls: 0, finalizations: 0, initializations: 0, released: 0 };
}

type ServiceCounts = ReturnType<typeof serviceCounts>;
const noRequirements = [] as const;
type NoRequirements<A, E = never, R extends Scope.Scope = never> = ServiceRequirements<typeof noRequirements, A, E, R>;

function initialize(counts: ServiceCounts) {
	return Effect.fn("StoryService.initialize")(function* (): NoRequirements<{ readonly identity: object }, never, Scope.Scope> {
		counts.initializations += 1;
		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				counts.finalizations += 1;
			}),
		);
		return { identity: {} };
	})();
}

export function scopedService(counts: ServiceCounts) {
	return defineService({
		id: "story/ScopedService",
		initialize: initialize(counts),
		methods: (state) => {
			counts.factoryCalls += 1;
			return {
				identity: () => Effect.succeed(state.identity),
				open: () =>
					Effect.acquireRelease(Effect.succeed("resource"), () =>
						Effect.sync(() => {
							counts.released += 1;
						}),
					),
				released: () => Effect.sync(() => counts.released),
			};
		},
		requires: noRequirements,
	});
}

export function requiredService() {
	const requirements = [Declared] as const;
	type Requirements<A> = ServiceRequirements<typeof requirements, A>;
	return defineService({
		id: "story/RequiredService",
		initialize: Effect.fn("RequiredService.initialize")(function* (): Requirements<{ readonly identity: object }> {
			return { identity: (yield* Declared).identity };
		})(),
		methods: (state) => ({
			greet: () => Effect.map(Declared, ({ prefix }) => prefix),
			sameIdentity: Effect.fn("RequiredService.sameIdentity")(function* (): Requirements<boolean> {
				return (yield* Declared).identity === state.identity;
			}),
		}),
		requires: requirements,
	});
}

function preserve<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<{ readonly value: A }, E, R> {
	return Effect.map(effect, (value) => ({ value }));
}

export function genericService() {
	return defineService({
		id: "story/GenericService",
		initialize: Effect.void,
		methods: () => ({ preserve: genericMethod(preserve) }),
		requires: noRequirements,
	});
}

type Acquired<TService> = Effect.Effect<Context.Service.Shape<TService>>;

export type BuiltService =
	| { readonly kind: "unbuilt" }
	| { readonly kind: "scoped"; readonly read: Acquired<ReturnType<typeof scopedService>> }
	| { readonly kind: "required"; readonly read: Acquired<ReturnType<typeof requiredService>> }
	| { readonly kind: "generic"; readonly read: Acquired<ReturnType<typeof genericService>> };

export type Declaration =
	| { readonly kind: "undeclared" }
	| { readonly kind: "scoped"; readonly service: ReturnType<typeof scopedService> }
	| { readonly kind: "required"; readonly service: ReturnType<typeof requiredService>; readonly prefix: string }
	| { readonly kind: "generic"; readonly service: ReturnType<typeof genericService> };

export interface ServiceEngine {
	built: BuiltService;
	readonly counts: ServiceCounts;
	declaration: Declaration;
	readonly scope: Scope.Closeable;
}

export function* serviceEngine(): Effect.fn.Return<ServiceEngine, never, Scope.Scope> {
	const scope = yield* Scope.fork(yield* Effect.scope);
	return { built: { kind: "unbuilt" }, counts: serviceCounts(), declaration: { kind: "undeclared" }, scope };
}

class InitializationFailed extends Data.TaggedError("InitializationFailed") {}
class MethodFailed extends Data.TaggedError("MethodFailed") {}
class Prefix extends Context.Service<Prefix, string>()("story/FailurePrefix") {}

export function failureEngine() {
	const counts = { factoryCalls: 0, finalized: 0 };
	const initializationFailure = new InitializationFailed();
	const methodFailure = new MethodFailed();
	const defect = new Error("method defect");
	const failedInitialization = defineService({
		id: "story/FailedInitialization",
		initialize: Effect.gen(function* () {
			yield* Effect.addFinalizer(() =>
				Effect.sync(() => {
					counts.finalized += 1;
				}),
			);
			return yield* Effect.fail(initializationFailure);
		}),
		methods: () => {
			counts.factoryCalls += 1;
			return { run: () => Effect.void };
		},
		requires: [],
	});
	const failedMethod = defineService({
		id: "story/MethodFailure",
		initialize: Effect.sync(() => ({ calls: 0 })),
		methods: (state) => ({
			run: Effect.fn("MethodFailure.run")(function* (fail: boolean) {
				const prefix = yield* Prefix;
				state.calls += 1;
				if (fail) {
					return yield* Effect.fail(methodFailure);
				}
				return `${prefix}${state.calls}`;
			}),
		}),
		requires: [Prefix],
	});
	const defectiveMethod = defineService({
		id: "story/MethodDefect",
		initialize: Effect.void,
		methods: () => ({ crash: () => Effect.die(defect) }),
		requires: [],
	});
	const methodLayer = failedMethod.layer.pipe(Layer.provide(Layer.succeed(Prefix, "call ")));
	return { counts, defect, defectiveMethod, failedInitialization, failedMethod, initializationFailure, methodFailure, methodLayer };
}

class Resource extends Context.Service<Resource, string>()("story/InterruptedResource") {}

export function* lifetimeEngine() {
	const acquired = yield* Deferred.make<void>();
	const started = yield* Deferred.make<void>();
	const counts = { finalized: 0, released: 0 };
	const initialization = { wait: false };
	const scope = yield* Scope.fork(yield* Effect.scope);
	const service = defineService({
		id: "story/ServiceLifetime",
		initialize: Effect.gen(function* () {
			yield* Effect.addFinalizer(() =>
				Effect.sync(() => {
					counts.finalized += 1;
				}),
			);
			yield* Deferred.succeed(started, undefined);
			if (initialization.wait) {
				yield* Effect.never;
			}
		}),
		methods: () => ({
			read: () => Effect.map(Resource, (resource) => resource),
			wait: Effect.fn("ServiceLifetime.wait")(function* () {
				yield* Effect.acquireRelease(Resource, () =>
					Effect.sync(() => {
						counts.released += 1;
					}),
				);
				yield* Deferred.succeed(acquired, undefined);
				return yield* Effect.never;
			}),
		}),
		requires: [Resource],
	});
	const layer = service.layer.pipe(Layer.provide(Layer.succeed(Resource, "resource")));
	return { acquired, counts, initialization, layer, scope, service, started };
}
