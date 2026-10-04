import { Effect, Schema } from "effect";
import type { WorkSpec } from "./domain.ts";
import { githubCommand } from "./githubCommand.ts";
import { validateTarget } from "./githubContract.ts";
import { failure } from "./ports.ts";

const Count = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(1000));
const Check = Schema.Struct({
	conclusion: Schema.NullOr(Schema.String),
	headSha: Schema.String,
	id: Schema.Number,
	name: Schema.String,
	status: Schema.String,
}).pipe(Schema.encodeKeys({ headSha: "head_sha" }));
const Status = Schema.Struct({ context: Schema.String, id: Schema.Number, state: Schema.String });
const CheckPages = Schema.Array(
	Schema.Struct({ checkRuns: Schema.Array(Check), totalCount: Count }).pipe(
		Schema.encodeKeys({ checkRuns: "check_runs", totalCount: "total_count" }),
	),
).check(Schema.isMinLength(1), Schema.isMaxLength(10));
const StatusPages = Schema.Array(
	Schema.Struct({ sha: Schema.String, statuses: Schema.Array(Status), totalCount: Count }).pipe(Schema.encodeKeys({ totalCount: "total_count" })),
).check(Schema.isMinLength(1), Schema.isMaxLength(10));
interface Evidence {
	readonly name: string;
	readonly state: "passed" | "failed" | "pending";
}
function stateFor(terminal: boolean, conclusion: string | null): Evidence["state"] {
	if (!terminal) {
		return "pending";
	}
	if (conclusion === "success") {
		return "passed";
	}
	if (["failure", "error", "timed_out", "cancelled", "action_required", "startup_failure"].includes(conclusion ?? "")) {
		return "failed";
	}
	return "pending";
}
function completePages(pages: ReadonlyArray<{ readonly totalCount: number }>, ids: ReadonlyArray<number>): boolean {
	return pages.every((page) => page.totalCount === ids.length) && new Set(ids).size === ids.length;
}
function readChecks(output: string, revision: string) {
	return Effect.gen(function* () {
		const pages = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(CheckPages))(output).pipe(
			Effect.mapError(() => failure("Commit check-run evidence is invalid or exceeds the observation limit", "retry")),
		);
		const checks = pages.flatMap((page) => page.checkRuns);
		if (
			!completePages(
				pages,
				checks.map((check) => check.id),
			)
			|| checks.some((check) => check.headSha !== revision)
		) {
			return yield* Effect.fail(failure("Commit check-run evidence is incomplete or belongs to another revision", "retry"));
		}
		return checks.map((check): Evidence => ({ name: check.name, state: stateFor(check.status === "completed", check.conclusion) }));
	});
}
function readStatuses(output: string, revision: string) {
	return Effect.gen(function* () {
		const pages = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(StatusPages))(output).pipe(
			Effect.mapError(() => failure("Commit status evidence is invalid or exceeds the observation limit", "retry")),
		);
		const statuses = pages.flatMap((page) => page.statuses);
		if (
			!completePages(
				pages,
				statuses.map((status) => status.id),
			)
			|| pages.some((page) => page.sha !== revision)
		) {
			return yield* Effect.fail(failure("Commit status evidence is incomplete or belongs to another revision", "retry"));
		}
		return statuses.map((status): Evidence => ({ name: status.context, state: stateFor(true, status.state) }));
	});
}
function observeCommit(work: WorkSpec, revision: string, suffix: string) {
	return githubCommand([
		"api",
		"--method",
		"GET",
		"--hostname",
		"github.com",
		"--paginate",
		"--slurp",
		`repos/${work.repository}/commits/${revision}/${suffix}`,
		"--header",
		"Accept: application/vnd.github+json",
	]);
}
export function githubRevisionChecks(work: WorkSpec, revision: string) {
	return Effect.gen(function* () {
		if (work.requiredChecks.length === 0) {
			return;
		}
		yield* validateTarget(work, 1);
		if (/^[a-f0-9]{40}$/iu.exec(revision) === null) {
			return yield* Effect.fail(failure("Commit checks require a full revision", "human"));
		}
		const checks = yield* readChecks(yield* observeCommit(work, revision, "check-runs?filter=latest&per_page=100"), revision);
		const statuses = yield* readStatuses(yield* observeCommit(work, revision, "status?per_page=100"), revision);
		const evidence = [...checks, ...statuses];
		for (const name of work.requiredChecks) {
			const matching = evidence.filter((entry) => entry.name === name);
			if (matching.some((entry) => entry.state === "failed")) {
				return yield* Effect.fail(failure(`Required commit check ${name} failed on the no-change revision`, "repair"));
			}
			if (matching.length === 0 || matching.some((entry) => entry.state !== "passed")) {
				return yield* Effect.fail(failure(`Required commit check ${name} has not passed on the no-change revision`, "retry"));
			}
		}
	});
}
