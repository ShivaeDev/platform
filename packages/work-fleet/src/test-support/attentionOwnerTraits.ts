import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
export function unconfiguredAdoption(controls: { readonly owner: () => "automation" | "orchestrator" }) {
	return engineConfiguration("unconfigured adoption", () => ({
		resultQuery: () =>
			Effect.fail(
				withFailureContext(new ServiceUnavailable({ message: "Adoption is not configured" }), {
					attentionOwner: controls.owner() === "automation" ? controls.owner() : undefined,
					retryable: false,
				}),
			),
	}));
}

export function pendingRequiredChecks(controls: { readonly pending: () => boolean }) {
	return engineConfiguration("pending required checks", () => ({
		checksQuery: (result) =>
			Effect.succeed({ evidence: ["Synthetic checks"], head: result.head, passed: !controls.pending(), pending: controls.pending() }),
	}));
}
