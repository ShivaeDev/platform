import { Effect, Schema } from "effect";
import type { PullRequest, WorkSpec } from "./domain.ts";
import { failure } from "./ports.ts";

const Commit = Schema.String.check(Schema.isPattern(/^[a-f0-9]{40}$/iu));
const Check = Schema.Union([
	Schema.Struct({ __typename: Schema.Literal("CheckRun"), conclusion: Schema.NullOr(Schema.String), name: Schema.String, status: Schema.String }),
	Schema.Struct({ __typename: Schema.Literal("StatusContext"), context: Schema.String, state: Schema.String }),
]);
const Response = Schema.Struct({
	baseRefName: Schema.String,
	baseRefOid: Commit,
	headRefOid: Commit,
	isDraft: Schema.Boolean,
	mergeable: Schema.String,
	mergeStateStatus: Schema.String,
	number: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
	state: Schema.Literals(["OPEN", "CLOSED", "MERGED"]),
	statusCheckRollup: Schema.NullOr(Schema.Array(Check)),
	url: Schema.String,
});
export const githubFields = Object.keys(Response.fields).join(",");
export function validateTarget(work: WorkSpec, number: number) {
	return /^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/u.exec(work.repository) !== null && Number.isSafeInteger(number) && number > 0
		? Effect.void
		: Effect.fail(failure("GitHub requires an owner/repository and positive pull request number", "human"));
}
function checkStatus(value: typeof Check.Type): PullRequest["checks"][number] {
	const name = value.__typename === "CheckRun" ? value.name : value.context;
	const terminal = value.__typename === "CheckRun" ? value.status === "COMPLETED" : value.state !== "PENDING";
	const conclusion = value.__typename === "CheckRun" ? value.conclusion : value.state;
	let status: PullRequest["checks"][number]["status"] = "pending";
	if (terminal && conclusion === "SUCCESS") {
		status = "passed";
	} else if (terminal && ["FAILURE", "ERROR", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE"].includes(conclusion ?? "")) {
		status = "failed";
	}
	return { name, status };
}
export function parsePullRequest(text: string, work: WorkSpec, number: number) {
	return Effect.gen(function* () {
		const response = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Response))(text).pipe(
			Effect.mapError(() => failure("GitHub returned an invalid pull request response", "retry")),
		);
		const expected = `https://github.com/${work.repository}/pull/${number}`;
		if (response.number !== number || response.url.toLowerCase() !== expected.toLowerCase() || response.baseRefName !== work.baseBranch) {
			return yield* Effect.fail(failure("GitHub pull request identity or base branch differs from approved work", "human"));
		}
		const checks = (response.statusCheckRollup ?? []).map(checkStatus);
		for (const name of work.requiredChecks) {
			if (!checks.some((check) => check.name === name)) {
				checks.push({ name, status: "pending" });
			}
		}
		const result: PullRequest = {
			baseRevision: response.baseRefOid,
			checks,
			mergeable: mergeability(response),
			number,
			revision: response.headRefOid,
			state: states[response.state],
			url: response.url,
		};
		return result;
	});
}
const states = { "CLOSED": "closed", "MERGED": "merged", "OPEN": "open" } as const;
function mergeability(response: typeof Response.Type): PullRequest["mergeable"] {
	if (response.mergeable === "CONFLICTING") {
		return "conflict";
	}
	if (response.isDraft) {
		return "blocked";
	}
	if (response.mergeable === "MERGEABLE" && response.mergeStateStatus === "CLEAN") {
		return "ready";
	}
	if (response.mergeable === "UNKNOWN" || response.mergeStateStatus === "UNKNOWN") {
		return "unknown";
	}
	return "blocked";
}
