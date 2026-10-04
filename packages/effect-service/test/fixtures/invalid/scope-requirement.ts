import { Effect, Scope } from "effect";
import { defineService } from "#define-service.ts";
import type { ServiceRequirements } from "#service-requirements.ts";

const requirements = [Scope.Scope] as const;
type Requirements<Success> = ServiceRequirements<typeof requirements, Success>;

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
