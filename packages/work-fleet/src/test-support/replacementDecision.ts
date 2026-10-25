import type { Decision } from "#policy.ts";
export function replacementDecision(decision: Decision | undefined, replaceDecision: boolean): Decision | undefined {
	return decision === undefined || !replaceDecision ? decision : { ...decision, code: "fleet-invalid", reason: "Replacement decision" };
}
