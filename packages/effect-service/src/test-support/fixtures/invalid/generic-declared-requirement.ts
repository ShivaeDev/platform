import { Context, Effect } from "effect";
import { defineService } from "#define-service.ts";
import { genericMethod } from "#generic-method.ts";

class Declared extends Context.Service<Declared, { readonly value: string }>()("invalid/Declared") {}

const generic = Effect.fn("InvalidGeneric.preserve")(
	<Success, Failure, Requirements>(effect: Effect.Effect<Success, Failure, Requirements>): Effect.Effect<Success, Failure, Requirements | Declared> =>
		Declared.pipe(Effect.andThen(effect)),
);

defineService({
	id: "invalid/GenericDeclaredRequirement",
	initialize: Effect.void,
	methods: () => ({ generic: genericMethod(generic) }),
	requires: [Declared],
});
