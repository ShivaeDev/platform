import { Effect, Schema } from "effect";
import { BadRequest } from "@shivaedev/errors/taxonomy.ts";
import type { FleetError } from "#errors.ts";
import type { Checks, Review, WorkResult } from "#policy.ts";
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

export function reviewerPrompt(input: {
	readonly task: string;
	readonly checks?: Checks | { readonly unavailable: string };
	readonly result: WorkResult;
	readonly reviewerGuidance?: string;
	readonly sharedEnvironment?: string;
}) {
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
		`Diff summary: ${input.result.kind === "change" ? input.result.paths.join(", ") : "No changed files"}`,
		`Check results: ${JSON.stringify(input.checks ?? "Inspect exact-head checks using the read-only tools below")}`,
		"",
		"Read root and package AGENTS.md. Inspect only the exact target head, using existing repository objects or read-only repository tools. The checkout may be a different revision; never review that revision in its place.",
		"You have no worker conversation. Judge the implementation and acceptance evidence independently.",
		"This session is read-only. Do not edit, commit, push, merge, publish comments or reviews, or launch workers. Do not request escalation. Shell network access is enabled for read-only inspection. Use `gh pr view`, `gh pr diff` and `gh api --method GET` to read the PR and exact-head CI results; verify the PR head before using its diff. Network writes are prohibited.",
		"When you can inspect the diff at the exact target head and its check results, always end with a verdict: approve or request changes in the format below. Never approve from the task text or a worker's claims alone.",
		"Passing required checks at that exact head are the CI evidence. Unavailable CI job logs or artifacts (including HTTP 403 from the Cloud GitHub token) alone must not withhold a verdict. Include the passing checks and the access limitation in your evidence list, then decide from the diff and available evidence.",
		"`main` is protected by a merge queue that re-runs CI against the latest main before merging. A branch behind main without conflicts is not a reason to request changes, repeat review or re-run validation; judge the exact target head and its checks. Workers merge main only when GitHub reports a conflict or the change needs something that landed there.",
		...(input.reviewerGuidance === undefined ? [] : ["Repository reviewer guidance:", input.reviewerGuidance]),
		"If the exact head, diff or check results cannot be inspected, report that limitation. Request changes for concrete implementation or validation gaps; unavailable job logs or artifacts alone are not such a gap.",
		"Write a review document with exactly these sections, in this order:",
		"## TL;DR",
		"Verdict: approve or request changes. Follow with at most five one-line findings, most important first. If there are no findings, say so in one line.",
		"## Details",
		"For each finding give its claim, evidence, likelihood in real use (likely or possible), impact, and a suggested fix. Omit remote findings. With no findings, write None.",
		"After Details, end with exactly one machine-readable line, with no Markdown fencing:",
		`${REVIEW_MARKER} ${JSON.stringify({ evidence: ["Evidence you inspected"], findings: [], head: input.result.head, verdict: "approve" })}`,
		'Use verdict "changes" with nonempty findings that give concrete repair guidance. Use "approve" only with no findings. Evidence must be nonempty for either verdict.',
	].join("\n");
}

export const readReviewerVerdict = Effect.fn("Fleet.readReviewerVerdict")(function* (
	output: string,
	receipt: SessionReceipt,
): Effect.fn.Return<Review, FleetError> {
	const lines = output.split("\n").filter((entry) => entry.trim().startsWith(REVIEW_MARKER));
	const line = lines.length === 1 ? lines[0] : undefined;
	if (line === undefined || output.trim().split("\n").at(-1)?.trim() !== line.trim()) {
		return yield* new BadRequest({ message: "Reviewer must end with one machine-readable verdict" });
	}
	const verdict = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(ReviewerVerdict))(line.trim().slice(REVIEW_MARKER.length).trim()).pipe(
		Effect.mapError(() => new BadRequest({ message: "Reviewer verdict is malformed or lacks evidence" })),
	);
	if ((verdict.verdict === "changes") !== verdict.findings.length > 0) {
		return yield* new BadRequest({ message: "Reviewer changes require findings; approval requires no findings" });
	}
	return { ...verdict, receipt, repairPrompt: verdict.findings.join("\n"), verdict: verdict.verdict === "approve" ? "approved" : "changes" };
});
