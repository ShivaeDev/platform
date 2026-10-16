import type { FleetRecord } from "#model.ts";

export function exhaustedCheckRepairs(record: FleetRecord, failures: readonly string[]): readonly string[] {
	const repairs = record.attempts
		.filter((attempt) => attempt.role !== "reviewer" && !(attempt.role === "repair" && attempt.status === "failed" && attempt.receipt === undefined))
		.slice(-3);
	if (repairs.length < 3 || repairs.some((attempt) => attempt.role !== "repair" || attempt.status !== "completed")) {
		return [];
	}
	return failures.filter((name) => repairs.every((attempt) => attempt.checkFailures?.includes(name)));
}
