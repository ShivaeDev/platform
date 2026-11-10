import { deadLetterResolutionPlan } from "#server/deadLetterResolutionPlan.ts";
import { deferralStorePlan } from "#server/deferralStorePlan.ts";
import { inspectionPlan } from "#server/inspectionPlan.ts";

export function jobStorePlans(schema: string): readonly string[] {
	return [deferralStorePlan(schema), deadLetterResolutionPlan(schema), inspectionPlan(schema)];
}
