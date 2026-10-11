import { Effect, Schema } from "effect";
import { FleetFailure, type Review, type WorkResult } from "#policy.ts";
import { cloudStartup } from "#prompt/worker.ts";
import type { SessionReceipt } from "#session/schema.ts";

export const REVIEW_MARKER = "FLEET_REVIEW:";
const Text = Schema.String.check(Schema.isPattern(/\S/u));
export const ReviewerVerdict = Schema.Struct({
	evidence: Schema.Array(Text).check(Schema.isMinLength(1)),
	findings: Schema.Array(Text),
	head: Text,
	verdict: Schema.Literals(["approve", "changes"]),
});

export function reviewerPrompt(input: { readonly task: string; readonly result: WorkResult; readonly sharedEnvironment?: string }) {
	return [
		"Independently review this task against its acceptance criteria.",
		...(input.sharedEnvironment === undefined ? [] : ["", cloudStartup({ sharedEnvironment: input.sharedEnvironment }, "read-only")]),
		"",
		"Task and criteria:",
		"---",
		input.task.trim(),
		"---",
		"",
		`Review target: ${JSON.stringify(input.result)}`,
		"",
		"Read root and package AGENTS.md. Inspect only the exact target head, using existing repository objects or read-only repository tools. The checkout may be a different revision; never review that revision in its place.",
		"You have no worker conversation. Judge the implementation and acceptance evidence independently.",
		"This session is read-only. Do not edit, commit, push, merge, publish comments or reviews, or launch workers. Do not request escalation. Shell network access is enabled for read-only inspection. Use `gh pr view`, `gh pr diff` and `gh api --method GET` to read the PR and exact-head CI results; verify the PR head before using its diff. Network writes are prohibited.",
		"If the exact head or required evidence cannot be inspected, report the limitation and end without a verdict. Never approve from the task text or a worker's claims alone.",
		"End with exactly one machine-readable line, with no Markdown fencing:",
		`${REVIEW_MARKER} ${JSON.stringify({ evidence: ["Evidence you inspected"], findings: [], head: input.result.head, verdict: "approve" })}`,
		'Use verdict "changes" with nonempty findings that give concrete repair guidance. Use "approve" only with no findings. Evidence must be nonempty for either verdict.',
	].join("\n");
}

export const readReviewerVerdict = Effect.fn("Fleet.readReviewerVerdict")(function* (
	output: string,
	receipt: SessionReceipt,
): Effect.fn.Return<Review, FleetFailure> {
	const lines = output.split("\n").filter((entry) => entry.trim().startsWith(REVIEW_MARKER));
	const line = lines.length === 1 ? lines[0] : undefined;
	if (line === undefined || output.trim().split("\n").at(-1)?.trim() !== line.trim()) {
		return yield* new FleetFailure({ message: "Reviewer must end with one machine-readable verdict", reason: "invalid" });
	}
	const verdict = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(ReviewerVerdict))(line.trim().slice(REVIEW_MARKER.length).trim()).pipe(
		Effect.mapError(() => new FleetFailure({ message: "Reviewer verdict is malformed or lacks evidence", reason: "invalid" })),
	);
	if ((verdict.verdict === "changes") !== verdict.findings.length > 0) {
		return yield* new FleetFailure({ message: "Reviewer changes require findings; approval requires no findings", reason: "invalid" });
	}
	return { ...verdict, receipt, repairPrompt: verdict.findings.join("\n"), verdict: verdict.verdict === "approve" ? "approved" : "changes" };
});
