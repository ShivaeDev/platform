import { Effect, Layer } from "effect";
import { Caller, Declared, type ServiceEngine } from "./serviceEngine.ts";

export function serviceVerbs(engine: ServiceEngine, tell: (line: string) => void) {
	return {
		callerResources: () =>
			Effect.gen(function* () {
				tell("two caller scopes open resources while the service remains live");
				const declaration = engine.declaration;
				if (declaration.kind !== "scoped") {
					return yield* Effect.die("Declare a scoped service before opening resources");
				}
				const Service = declaration.service;
				return yield* Effect.gen(function* () {
					const service = yield* Service;
					const first = yield* Effect.scoped(service.open());
					const afterFirst = engine.counts.released;
					const second = yield* Effect.scoped(service.open());
					return { afterFirst, afterSecond: engine.counts.released, finalizations: engine.counts.finalizations, resources: [first, second] };
				}).pipe(Effect.provide(Service.layer, { local: true }));
			}),
		identities: () =>
			Effect.gen(function* () {
				tell("two callers read private identities from one service Layer");
				const declaration = engine.declaration;
				if (declaration.kind !== "scoped") {
					return yield* Effect.die("Declare a scoped service before reading identities");
				}
				const Service = declaration.service;
				return yield* Effect.gen(function* () {
					const first = yield* Service;
					const second = yield* Service;
					return yield* Effect.all([first.identity(), second.identity()]);
				}).pipe(Effect.provide(Service.layer, { local: true }));
			}),
		lifetime: () => ({ ...engine.counts }),
		preserveCaller: (value: number) =>
			Effect.gen(function* () {
				tell(`the generic method preserves a caller service with value ${value}`);
				const declaration = engine.declaration;
				if (declaration.kind !== "generic") {
					return yield* Effect.die("Declare a generic method before preserving a caller");
				}
				const Service = declaration.service;
				return yield* Service.pipe(
					Effect.flatMap((service) => service.preserve(Effect.map(Caller, (caller) => caller.value))),
					Effect.provide(Service.layer, { local: true }),
					Effect.provideService(Caller, { value }),
				);
			}),
		requirement: (callerPrefix?: string) =>
			Effect.gen(function* () {
				tell(
					callerPrefix === undefined
						? "initialization and a method read the declared requirement"
						: `the caller overrides the prefix with ${callerPrefix}`,
				);
				const declaration = engine.declaration;
				if (declaration.kind !== "required") {
					return yield* Effect.die("Declare a requirement before calling its methods");
				}
				const Service = declaration.service;
				const layer = Service.layer.pipe(Layer.provide(Layer.succeed(Declared, { identity: {}, prefix: declaration.prefix })));
				return yield* Effect.gen(function* () {
					const service = yield* Service;
					const greet = service.greet();
					return {
						prefix: yield* callerPrefix === undefined ? greet : greet.pipe(Effect.provideService(Declared, { identity: {}, prefix: callerPrefix })),
						sameIdentity: yield* service.sameIdentity(),
					};
				}).pipe(Effect.provide(layer, { local: true }));
			}),
	};
}
