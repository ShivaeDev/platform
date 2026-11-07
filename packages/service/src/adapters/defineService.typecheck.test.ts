import { Context, Effect, Layer, Schema, SchemaGetter, type Scope } from "effect";
import { expectTypeOf } from "vitest";
import { defineService } from "#adapters/defineService.ts";
import { genericMethod } from "#genericMethod.ts";

class Declared extends Context.Service<Declared, string>()("@shivaedev/service/typecheck/Declared") {}
class Caller extends Context.Service<Caller, number>()("@shivaedev/service/typecheck/Caller") {}
class DecodeService extends Context.Service<DecodeService, string>()("@shivaedev/service/typecheck/DecodeService") {}

const WithService = Schema.Struct({ value: Schema.String }).pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transformEffect((value: { readonly value: string }) => Effect.map(DecodeService, (prefix) => `${prefix}${value.value}`)),
		encode: SchemaGetter.transform((value: string) => ({ value })),
	}),
);

function decode<TSchema extends Schema.Constraint>(schema: TSchema, value: unknown) {
	return Schema.decodeUnknownEffect(schema)(value);
}

const SchemaGeneric = defineService({
	id: "@shivaedev/service/typecheck/SchemaGeneric",
	initialize: Effect.void,
	methods: () => ({ decode: genericMethod(decode) }),
	requires: [],
});

function decodeWithService<TSchema extends Schema.Constraint>(schema: TSchema) {
	return Effect.flatMap(SchemaGeneric, (service) => service.decode(schema, "value"));
}

const schemaDecoded = decodeWithService(WithService);
expectTypeOf<Effect.Success<typeof schemaDecoded>>().toEqualTypeOf<typeof WithService.Type>();
expectTypeOf<Effect.Services<typeof schemaDecoded>>().toEqualTypeOf<Context.Service.Identifier<typeof SchemaGeneric> | DecodeService>();

const Preference = Context.Reference("@shivaedev/service/typecheck/Preference", { defaultValue: () => "default" });

const Referenced = defineService({
	id: "@shivaedev/service/typecheck/Referenced",
	initialize: Preference,
	methods: (initial) => ({ initial: () => Effect.succeed(initial), read: () => Preference }),
	requires: [Preference],
});

expectTypeOf(Referenced.layer).toEqualTypeOf<Layer.Layer<"@shivaedev/service/typecheck/Referenced">>();
expectTypeOf<Context.Service.Shape<typeof Referenced>["read"]>().returns.toEqualTypeOf<Effect.Effect<string>>();

const CurrentScope = Context.Reference<Scope.Scope | undefined>("@shivaedev/service/typecheck/CurrentScope", { defaultValue: () => undefined });

const ScopedReference = defineService({
	id: "@shivaedev/service/typecheck/ScopedReference",
	initialize: Declared,
	methods: () => ({ open: () => Effect.scope, read: () => CurrentScope }),
	requires: [Declared, CurrentScope],
});

expectTypeOf(ScopedReference.layer).toEqualTypeOf<Layer.Layer<"@shivaedev/service/typecheck/ScopedReference", never, Declared>>();
expectTypeOf<Context.Service.Shape<typeof ScopedReference>["open"]>().returns.toEqualTypeOf<Effect.Effect<Scope.Scope, never, Scope.Scope>>();

const Generic = defineService({
	id: "@shivaedev/service/typecheck/Generic",
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

const callerLayer = Layer.effect(Context.Service<number>("@shivaedev/service/typecheck/Result"))(program);
expectTypeOf(callerLayer).toEqualTypeOf<Layer.Layer<number, never, Caller>>();
// @ts-expect-error Building a Layer does not satisfy the generic method's caller requirement.
Effect.runPromise(Effect.scoped(Layer.build(callerLayer)));

defineService({
	id: "@shivaedev/service/typecheck/MissingGenericCaller",
	// @ts-expect-error Caller is not declared, so initialization cannot call the generic method with it.
	initialize: Generic.use((service) => service.preserve(Caller)),
	methods: () => ({}),
	requires: [Generic],
});
