import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/contract/errors/taxonomy.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";

export function unconfiguredAdoption(controls: { readonly owner: () => "automation" | "orchestrator" }) {
	return (): EngineOptions => ({
		resultQuery: () =>
			Effect.fail(
				withFailureContext(new ServiceUnavailable({ message: "Adoption is not configured" }), {
					attentionOwner: controls.owner() === "automation" ? controls.owner() : undefined,
					retryable: false,
				}),
			),
	});
}

export function pendingRequiredChecks(controls: { readonly pending: () => boolean }) {
	return (): EngineOptions => ({
		checksQuery: (result) =>
			Effect.succeed({ evidence: ["Synthetic checks"], head: result.head, passed: !controls.pending(), pending: controls.pending() }),
	});
}
