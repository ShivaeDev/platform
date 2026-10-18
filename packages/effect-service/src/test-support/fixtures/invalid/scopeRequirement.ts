import { Effect, Scope } from "effect";
import { defineService } from "#defineService.ts";
import type { ServiceRequirements } from "#ServiceRequirements.ts";

const requirements = [Scope.Scope] as const;
type Requirements<TSuccess> = ServiceRequirements<typeof requirements, TSuccess>;

defineService({
	id: "invalid/ScopeRequirement",
	initialize: Effect.void,
	methods: () => ({
		scoped: Effect.fn("InvalidScope.scoped")(function* (): Requirements<void> {
			yield* Scope.Scope;
		}),
	}),
	requires: requirements,
});
