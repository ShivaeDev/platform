import { Effect, Exit, Scope } from "effect";
import { Caller, Declared, type ServiceEngine } from "./serviceEngine.ts";

export function serviceVerbs(engine: ServiceEngine, tell: (line: string) => void) {
	return {
		close: () => {
			tell("the service Layer's lifetime ends");
			return Scope.close(engine.scope, Exit.void);
		},
		greet: ({ callerPrefix }: { readonly callerPrefix?: string } = {}) =>
			Effect.gen(function* () {
				tell(callerPrefix === undefined ? "the service greets the caller" : `the caller greets with an overridden prefix ${callerPrefix}`);
				const declaration = engine.declaration;
				if (declaration.kind !== "required") {
					return yield* Effect.die("Declare a requirement before greeting");
				}
				const service = yield* declaration.read;
				const greet = service.greet();
				return yield* callerPrefix === undefined ? greet : greet.pipe(Effect.provideService(Declared, { identity: {}, prefix: callerPrefix }));
			}),
		identity: () =>
			Effect.gen(function* () {
				tell("a caller reads the service's private identity");
				const declaration = engine.declaration;
				if (declaration.kind !== "scoped") {
					return yield* Effect.die("Declare a scoped service before reading its identity");
				}
				const service = yield* declaration.read;
				return yield* service.identity();
			}),
		open: () =>
			Effect.gen(function* () {
				tell("a caller opens a resource in its own scope");
				const declaration = engine.declaration;
				if (declaration.kind !== "scoped") {
					return yield* Effect.die("Declare a scoped service before opening a resource");
				}
				const service = yield* declaration.read;
				return yield* Effect.scoped(service.open());
			}),
		preserveCaller: (value: number) =>
			Effect.gen(function* () {
				tell(`the generic method preserves a caller service with value ${value}`);
				const declaration = engine.declaration;
				if (declaration.kind !== "generic") {
					return yield* Effect.die("Declare a generic method before preserving a caller");
				}
				const service = yield* declaration.read;
				return yield* service.preserve(Effect.map(Caller, (caller) => caller.value)).pipe(Effect.provideService(Caller, { value }));
			}),
		released: () =>
			Effect.gen(function* () {
				tell("the service reports its released resources");
				const declaration = engine.declaration;
				if (declaration.kind !== "scoped") {
					return yield* Effect.die("Declare a scoped service before reading released resources");
				}
				const service = yield* declaration.read;
				return yield* service.released();
			}),
		sameIdentity: () =>
			Effect.gen(function* () {
				tell("the method compares its declared requirement with the initialized identity");
				const declaration = engine.declaration;
				if (declaration.kind !== "required") {
					return yield* Effect.die("Declare a requirement before comparing identities");
				}
				const service = yield* declaration.read;
				return yield* service.sameIdentity();
			}),
	};
}
