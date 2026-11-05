import { inspectionPlan } from "#server/adapters/inspectionPlan.ts";
import { deadLetterResolutionPlan } from "#server/deadLetterResolutionPlan.ts";
import { deferralStorePlan } from "#server/deferralStorePlan.ts";

export function jobStorePlans(schema: string): readonly string[] {
	return [deferralStorePlan(schema), deadLetterResolutionPlan(schema), inspectionPlan(schema)];
}
