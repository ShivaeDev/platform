import { expect } from "@effect/vitest";
import { Context, Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { defineService } from "#define-service.ts";
import { genericMethod } from "#generic-method.ts";

class Caller extends Context.Service<Caller, { readonly value: number }>()("test/GenericCaller") {}

function preserve<TSuccess, TFailure, TRequirements>(
	effect: Effect.Effect<TSuccess, TFailure, TRequirements>,
): Effect.Effect<{ readonly value: TSuccess }, TFailure, TRequirements> {
	return Effect.map(effect, (value) => ({ value }));
}

const Generic = defineService({
	id: "test/Generic",
	initialize: Effect.void,
	methods: () => ({ preserve: genericMethod(preserve) }),
	requires: [],
});

it.effect("preserves each generic call's caller requirement", function* () {
	const result = yield* Generic.pipe(
		Effect.flatMap((service) => service.preserve(Effect.map(Caller, ({ value }) => value))),
		Effect.provide(Generic.layer, { local: true }),
		Effect.provideService(Caller, { value: 42 }),
	);

	expect(result).toEqual({ value: 42 });
});
