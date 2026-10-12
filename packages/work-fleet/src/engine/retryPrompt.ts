import type { Attempt, FleetRecord } from "#model.ts";

export function retryPrompt(previous: FleetRecord, attempt: Attempt) {
	return [
		previous.prompt,
		previous.review?.repairPrompt,
		previous.checks?.repairPrompt,
		previous.decision?.code === "worker-question" ? `Worker question:\n${previous.decision.reason}\n\nRecorded answer:` : undefined,
		attempt.prompt,
		`Continue on the same branch and PR${previous.result?.kind === "change" ? ` (${previous.result.pr})` : " created by the previous worker"}. Reuse that branch; do not create another branch or PR.`,
	]
		.filter(Boolean)
		.join("\n\n");
}
