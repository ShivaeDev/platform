import { Context, Effect } from "effect";
import { Reactivity } from "effect/reactivity/Reactivity";
import { defineService } from "#adapters/defineService.ts";

class Declared extends Context.Service<Declared, object>()("@shivaedev/service/invalid/Declared") {}
class Secret extends Context.Service<Secret, object>()("@shivaedev/service/invalid/Secret") {}

defineService({
	id: "@shivaedev/service/invalid/MethodRequirements",
	initialize: Effect.void,
	methods: () => ({
		read: () => Secret,
		write: () => Effect.all([Declared, Effect.scope, Reactivity, Secret]),
	}),
	requires: [Declared],
});
