import { Context, Effect } from "effect";
import { defineService } from "#defineService.ts";

class Declared extends Context.Service<Declared, object>()("@shivaedev/service/invalid/Declared") {}
class Secret extends Context.Service<Secret, object>()("@shivaedev/service/invalid/Secret") {}

defineService({
	id: "@shivaedev/service/invalid/InitializerRequirement",
	initialize: Effect.gen(function* () {
		yield* Declared;
		yield* Secret;
		return {};
	}),
	methods: () => ({
		value: () => Effect.void,
	}),
	requires: [Declared],
});
