import { Context, Effect } from "effect";
import { defineService } from "#define-service.ts";
import { genericMethod } from "#generic-method.ts";

class Secret extends Context.Service<Secret, object>()("invalid/Secret") {}

const preserve = Effect.fn("InvalidRequirementFree.preserve")(<Value>(value: Value) => Effect.succeed(value));

defineService({
	id: "invalid/RequirementFreeOrdinaryRequirement",
	initialize: Effect.void,
	methods: () => ({
		preserve: genericMethod(preserve),
		value: Effect.fn("InvalidRequirementFree.value")(function* () {
			yield* Secret;
		}),
	}),
	requires: [],
});
