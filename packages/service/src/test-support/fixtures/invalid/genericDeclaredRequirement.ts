import { Context, Effect } from "effect";
import { defineService } from "#defineService.ts";
import { genericMethod } from "#genericMethod.ts";

class Declared extends Context.Service<Declared, { readonly value: string }>()("invalid/Declared") {}

const generic = Effect.fn("InvalidGeneric.generic")(
	<TSuccess, TFailure, TRequirements>(
		effect: Effect.Effect<TSuccess, TFailure, TRequirements>,
	): Effect.Effect<TSuccess, TFailure, TRequirements | Declared> => Declared.pipe(Effect.andThen(effect)),
);

defineService({
	id: "invalid/GenericDeclaredRequirement",
	initialize: Effect.void,
	methods: () => ({ generic: genericMethod(generic) }),
	requires: [Declared],
});
