import { Context, Effect } from "effect";
import { defineService } from "#defineService.ts";

class Declared extends Context.Service<Declared, object>()("@shivaedev/service/invalid/Declared") {}
class Secret extends Context.Service<Secret, object>()("@shivaedev/service/invalid/Secret") {}

defineService({
	id: "@shivaedev/service/invalid/MethodRequirement",
	initialize: Effect.void,
	methods: () => ({
		value: Effect.fn("InvalidMethod.value")(function* () {
			yield* Declared;
			yield* Secret;
		}),
	}),
	requires: [Declared],
});
