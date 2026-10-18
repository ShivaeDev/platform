import { Context, Effect, type Scope } from "effect";
import { defineService } from "#define-service.ts";
import { genericMethod } from "#generic-method.ts";
import type { ServiceRequirements } from "#service-requirements.ts";

export class Declared extends Context.Service<Declared, { readonly identity: object; readonly prefix: string }>()("story/Declared") {}
export class Caller extends Context.Service<Caller, { readonly value: number }>()("story/Caller") {}

export function lifetime() {
	return { factoryCalls: 0, finalizations: 0, initializations: 0, released: 0 };
}

type Lifetime = ReturnType<typeof lifetime>;
const noRequirements = [] as const;
type NoRequirements<A, E = never, R extends Scope.Scope = never> = ServiceRequirements<typeof noRequirements, A, E, R>;

function initialize(counts: Lifetime) {
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

export function scopedService(counts: Lifetime) {
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

export type Declaration =
	| { readonly kind: "scoped"; readonly service: ReturnType<typeof scopedService> }
	| { readonly kind: "required"; readonly service: ReturnType<typeof requiredService>; readonly prefix: string }
	| { readonly kind: "generic"; readonly service: ReturnType<typeof genericService> };

export function serviceEngine(): { counts: Lifetime; declaration: Declaration } {
	const counts = lifetime();
	const declaration: Declaration = { kind: "scoped", service: scopedService(counts) };
	return { counts, declaration };
}

export type ServiceEngine = ReturnType<typeof serviceEngine>;
