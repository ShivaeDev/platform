import { Context, Effect } from "effect";
import { defineService } from "#defineService.ts";
import { genericMethod } from "#genericMethod.ts";

class Secret extends Context.Service<Secret, object>()("invalid/Secret") {}

const preserve = Effect.fn("InvalidRequirementFree.preserve")(<TValue>(value: TValue) => Effect.succeed(value));

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
