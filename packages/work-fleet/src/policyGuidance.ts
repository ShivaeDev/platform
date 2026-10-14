import { Effect } from "effect";
import type { FleetConfiguration } from "#policy.ts";

export function policyGuidance(policy: FleetConfiguration, role: "worker" | "reviewer") {
	return policy.readGuidance?.(role) ?? Effect.succeed(role === "worker" ? policy.workerGuidance : policy.reviewerGuidance);
}
