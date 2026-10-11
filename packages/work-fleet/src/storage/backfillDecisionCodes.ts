import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";
import type { DecisionCode } from "#DecisionCode.ts";

// These are historical persisted values, frozen independently of runtime copy.
const legacyCodes: Readonly<Record<string, DecisionCode>> = {
	"Current Board revision needs maintainer approval": "approval-required",
	"Delivered revision differs from reviewed head": "delivery-head-mismatch",
	"Delivery requires the adopted GitHub PR URL": "delivery-pr-required",
	"GitHub checks need a GitHub pull request URL and an exact commit SHA": "checks-result-invalid",
	"incomplete-context": "incomplete-context",
	"incomplete-observation": "incomplete-observation",
	"Merged PR head differs from the reported head; inspect delivery before accepting this work": "worker-report-merged-head-mismatch",
	"Multiple Codex turns match one operation; retain reservation": "duplicate-turns",
	"No-change validation is not configured in this Fleet host; inspect the worker session": "no-change-checks-unconfigured",
	"not-ancestor": "not-ancestor",
	"PR head differs from the reviewed head; review the current revision before accepting delivery": "pr-head-moved",
	"PR head moved after the worker report": "worker-report-head-moved",
	"Report worker published to GitHub": "report-published",
	"Report worker returned empty output": "empty-report",
	"Reported PR must belong to the host repository": "foreign-pr",
	"Result identity changed during review": "result-identity-changed",
	"Review lacks the adopted worker receipt": "worker-receipt-missing",
	"Reviewed PR is ready to merge": "reviewed-pr-ready",
	"relevant-change": "relevant-change",
	"Work is no longer approved or is done or superseded": "approval-required",
	"Worker report exceeds Board’s 256 KiB context limit, including metadata and receipt; request a shorter report before retrying.":
		"report-too-large",
	"Worker report needs one FLEET_HEAD line with the exact full head SHA immediately before the final PR line": "worker-report-head-invalid",
	"Worker report needs one final FLEET_PR line containing a GitHub PR URL or none": "worker-report-pr-invalid",
};
const ObjectValue = Schema.Record(Schema.String, Schema.Unknown);

function historicalCode(reason: string): DecisionCode {
	if (Object.hasOwn(legacyCodes, reason)) {
		return legacyCodes[reason] ?? "integration-failure";
	}
	if (reason.startsWith("Provider turn ")) {
		return "worker-terminal";
	}
	return reason.startsWith("Reviewer turn ") ? "reviewer-terminal" : "integration-failure";
}

function backfillCycle(cycle: Readonly<Record<string, unknown>>) {
	const decision = cycle.decision;
	if (!Schema.is(ObjectValue)(decision) || decision.code !== undefined) {
		return cycle;
	}
	const reason = typeof decision.reason === "string" ? decision.reason : "";
	const code = decision.worker === undefined ? historicalCode(reason) : "worker-question";
	return { ...cycle, decision: { ...decision, code } };
}

export const backfillDecisionCodes = Effect.fn("FleetStore.backfillDecisionCodes")(function* (namespace: string) {
	const sql = yield* SqlClient.SqlClient;
	const rows = yield* sql<{ readonly workId: string; readonly payload: Readonly<Record<string, unknown>> }>`
		select work_id as "workId", payload from ${sql(`${namespace}_records`)} order by work_id for update`;
	for (const row of rows) {
		const cycle = backfillCycle(row.payload);
		const history = Array.isArray(row.payload.history) ? row.payload.history : [];
		const updatedHistory = history.map((entry: unknown) => (Schema.is(ObjectValue)(entry) ? backfillCycle(entry) : entry));
		if (cycle === row.payload && updatedHistory.every((entry, index) => entry === history[index])) {
			continue;
		}
		const payload = { ...cycle, ...(row.payload.history === undefined ? {} : { history: updatedHistory }) };
		yield* sql`update ${sql(`${namespace}_records`)} set version = version + 1, payload = ${JSON.stringify(payload)}::jsonb where work_id = ${row.workId}`;
	}
});
