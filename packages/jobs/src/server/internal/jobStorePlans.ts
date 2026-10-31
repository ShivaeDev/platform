import { deadLetterResolutionPlan } from "#internal/deadLetterResolutionPlan.ts";
import { deferralStorePlan } from "#internal/deferralStorePlan.ts";

export function jobStorePlans(schema: string): readonly string[] {
	return [deferralStorePlan(schema), deadLetterResolutionPlan(schema)];
}
