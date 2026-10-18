import { Effect, Exit, Layer, Scope } from "effect";
import { Caller, Declared, type ServiceEngine } from "./serviceEngine.ts";

export function serviceVerbs(engine: ServiceEngine, tell: (line: string) => void) {
	return {
		build: () =>
			Effect.gen(function* () {
				tell("the declared service Layer is built");
				const declaration = engine.declaration;
				switch (declaration.kind) {
					case "scoped": {
						const context = yield* Layer.buildWithScope(declaration.service.layer, engine.scope);
						engine.built = { kind: "scoped", read: Effect.provide(declaration.service, context) };
						return;
					}
					case "required": {
						const layer = declaration.service.layer.pipe(Layer.provide(Layer.succeed(Declared, { identity: {}, prefix: declaration.prefix })));
						const context = yield* Layer.buildWithScope(layer, engine.scope);
						engine.built = { kind: "required", read: Effect.provide(declaration.service, context) };
						return;
					}
					case "generic": {
						const context = yield* Layer.buildWithScope(declaration.service.layer, engine.scope);
						engine.built = { kind: "generic", read: Effect.provide(declaration.service, context) };
						return;
					}
					case "undeclared":
						return yield* Effect.die("Declare a service before building its Layer");
				}
			}),
		close: () => {
			tell("the service Layer's lifetime ends");
			if (engine.built.kind === "unbuilt") {
				return Effect.die("Build a service before closing its Layer");
			}
			return Scope.close(engine.scope, Exit.void);
		},
		greet: ({ callerPrefix }: { readonly callerPrefix?: string } = {}) =>
			Effect.gen(function* () {
				tell(callerPrefix === undefined ? "the service greets the caller" : `the caller greets with an overridden prefix ${callerPrefix}`);
				const built = engine.built;
				if (built.kind !== "required") {
					return yield* Effect.die("Build a service with a requirement before greeting");
				}
				const service = yield* built.read;
				const greet = service.greet();
				return yield* callerPrefix === undefined ? greet : greet.pipe(Effect.provideService(Declared, { identity: {}, prefix: callerPrefix }));
			}),
		identity: () =>
			Effect.gen(function* () {
				tell("a caller reads the service's private identity");
				const built = engine.built;
				if (built.kind !== "scoped") {
					return yield* Effect.die("Build a scoped service before reading its identity");
				}
				const service = yield* built.read;
				return yield* service.identity();
			}),
		open: () =>
			Effect.gen(function* () {
				tell("a caller opens a resource in its own scope");
				const built = engine.built;
				if (built.kind !== "scoped") {
					return yield* Effect.die("Build a scoped service before opening a resource");
				}
				const service = yield* built.read;
				return yield* Effect.scoped(service.open());
			}),
		preserveCaller: (value: number) =>
			Effect.gen(function* () {
				tell(`the generic method preserves a caller service with value ${value}`);
				const built = engine.built;
				if (built.kind !== "generic") {
					return yield* Effect.die("Build a service with a generic method before preserving a caller");
				}
				const service = yield* built.read;
				return yield* service.preserve(Effect.map(Caller, (caller) => caller.value)).pipe(Effect.provideService(Caller, { value }));
			}),
		released: () =>
			Effect.gen(function* () {
				tell("the service reports its released resources");
				const built = engine.built;
				if (built.kind !== "scoped") {
					return yield* Effect.die("Build a scoped service before reading released resources");
				}
				const service = yield* built.read;
				return yield* service.released();
			}),
		sameIdentity: () =>
			Effect.gen(function* () {
				tell("the method compares its declared requirement with the initialized identity");
				const built = engine.built;
				if (built.kind !== "required") {
					return yield* Effect.die("Build a service with a requirement before comparing identities");
				}
				const service = yield* built.read;
				return yield* service.sameIdentity();
			}),
	};
}
