import { Context, Effect } from "effect";
import { defineService } from "../../../src/index.ts";

class Declared extends Context.Service<Declared, object>()("invalid/Declared") {}
class Secret extends Context.Service<Secret, object>()("invalid/Secret") {}

defineService({
	id: "invalid/MethodRequirement",
	initialize: Effect.void,
	methods: () => ({
		value: Effect.fn("InvalidMethod.value")(function* () {
			yield* Declared;
			yield* Secret;
		}),
	}),
	requires: [Declared],
});
