import { Context, Effect, Layer, type Scope } from "effect";
import { expectTypeOf } from "vitest";
import { defineService } from "#defineService.ts";
import { genericMethod } from "#genericMethod.ts";

class Declared extends Context.Service<Declared, string>()("typecheck/Declared") {}
class Caller extends Context.Service<Caller, number>()("typecheck/Caller") {}

const Preference = Context.Reference("typecheck/Preference", { defaultValue: () => "default" });

const Referenced = defineService({
	id: "typecheck/Referenced",
	initialize: Preference,
	methods: (initial) => ({ initial: () => Effect.succeed(initial), read: () => Preference }),
	requires: [Preference],
});

expectTypeOf(Referenced.layer).toEqualTypeOf<Layer.Layer<"typecheck/Referenced">>();
expectTypeOf<Context.Service.Shape<typeof Referenced>["read"]>().returns.toEqualTypeOf<Effect.Effect<string>>();

const CurrentScope = Context.Reference<Scope.Scope | undefined>("typecheck/CurrentScope", { defaultValue: () => undefined });

const ScopedReference = defineService({
	id: "typecheck/ScopedReference",
	initialize: Declared,
	methods: () => ({ open: () => Effect.scope, read: () => CurrentScope }),
	requires: [Declared, CurrentScope],
});

expectTypeOf(ScopedReference.layer).toEqualTypeOf<Layer.Layer<"typecheck/ScopedReference", never, Declared>>();
expectTypeOf<Context.Service.Shape<typeof ScopedReference>["open"]>().returns.toEqualTypeOf<Effect.Effect<Scope.Scope, never, Scope.Scope>>();

const Generic = defineService({
	id: "typecheck/Generic",
	initialize: Declared,
	methods: () => ({
		preserve: genericMethod(<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => effect),
	}),
	requires: [Declared],
});

const program = Effect.gen(function* () {
	const service = yield* Generic;
	return yield* service.preserve(Caller);
}).pipe(Effect.provide(Generic.layer), Effect.provideService(Declared, "declared"));

expectTypeOf(program).toEqualTypeOf<Effect.Effect<number, never, Caller>>();
// @ts-expect-error The generic method's caller requirement must be provided before execution.
Effect.runPromise(program);
Effect.runPromise(program.pipe(Effect.provideService(Caller, 42)));

const callerLayer = Layer.effect(Context.Service<number>("typecheck/Result"))(program);
expectTypeOf(callerLayer).toEqualTypeOf<Layer.Layer<number, never, Caller>>();
// @ts-expect-error Building a Layer does not satisfy the generic method's caller requirement.
Effect.runPromise(Effect.scoped(Layer.build(callerLayer)));

defineService({
	id: "typecheck/MissingGenericCaller",
	// @ts-expect-error Caller is not declared, so initialization cannot call the generic method with it.
	initialize: Generic.use((service) => service.preserve(Caller)),
	methods: () => ({}),
	requires: [Generic],
});
