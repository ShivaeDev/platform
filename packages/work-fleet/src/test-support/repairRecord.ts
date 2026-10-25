import type { FleetRecord } from "#model.ts";
export function repairRecord(record: FleetRecord, kind: "review" | "checks", repairPrompt: string): FleetRecord {
	const { review, checks } = record;
	if (review === undefined || checks === undefined) {
		throw new Error("Expected done review and checks");
	}
	return {
		...record,
		checks: kind === "checks" ? { ...checks, failedChecks: ["database"], passed: false, repairPrompt } : undefined,
		decision: undefined,
		review: kind === "review" ? { ...review, findings: [repairPrompt], repairPrompt, verdict: "changes" } : review,
		step: "repairing",
	};
}
