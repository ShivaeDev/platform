import { Order, Schema } from "effect";
import type { Checks } from "#policy.ts";

const CheckRun = Schema.Struct({
	completedAt: Schema.optional(Schema.NullOr(Schema.String)),
	conclusion: Schema.NullOr(Schema.String),
	detailsUrl: Schema.NullOr(Schema.String),
	headSha: Schema.String,
	htmlUrl: Schema.String,
	name: Schema.String,
	startedAt: Schema.optional(Schema.NullOr(Schema.String)),
	status: Schema.String,
}).pipe(
	Schema.encodeKeys({ completedAt: "completed_at", detailsUrl: "details_url", headSha: "head_sha", htmlUrl: "html_url", startedAt: "started_at" }),
);
export const CheckPages = Schema.Array(Schema.Struct({ checkRuns: Schema.Array(CheckRun) }).pipe(Schema.encodeKeys({ checkRuns: "check_runs" })));
const Status = Schema.Struct({ context: Schema.String, state: Schema.String, targetUrl: Schema.NullOr(Schema.String) }).pipe(
	Schema.encodeKeys({ targetUrl: "target_url" }),
);
export const StatusPages = Schema.Array(Schema.Struct({ sha: Schema.String, statuses: Schema.Array(Status) }));

interface Observation {
	readonly name: string;
	readonly state: "pass" | "fail" | "pending";
	readonly url: string;
}
function checkState(check: typeof CheckRun.Type): Observation["state"] {
	if (check.status !== "completed" || check.conclusion === null) {
		return "pending";
	}
	if (["success", "neutral", "skipped"].includes(check.conclusion)) {
		return "pass";
	}
	return ["failure", "cancelled", "timed_out", "action_required", "stale", "startup_failure"].includes(check.conclusion) ? "fail" : "pending";
}
function statusState(state: string): Observation["state"] {
	if (state === "success") {
		return "pass";
	}
	return ["error", "failure"].includes(state) ? "fail" : "pending";
}
function newestChecks(pages: typeof CheckPages.Type) {
	const newest = new Map<string, typeof CheckRun.Type>();
	function time(check: typeof CheckRun.Type) {
		return Date.parse(check.completedAt ?? check.startedAt ?? "") || 0;
	}
	for (const check of pages.flatMap((page) => page.checkRuns)) {
		const previous = newest.get(check.name);
		if (previous === undefined || time(check) > time(previous)) {
			newest.set(check.name, check);
		}
	}
	return [...newest.values()];
}
export function githubCheckState(
	head: string,
	pr: string,
	checks: typeof CheckPages.Type,
	statuses: typeof StatusPages.Type,
	required: readonly string[],
): Checks {
	const observations: Observation[] = [
		...newestChecks(checks).map((check) => ({ name: check.name, state: checkState(check), url: check.detailsUrl ?? check.htmlUrl })),
		...statuses.flatMap((page) =>
			page.statuses.map(
				(status): Observation => ({
					name: status.context,
					state: statusState(status.state),
					url: status.targetUrl ?? `${pr.split("/pull/")[0]}/commit/${head}/checks`,
				}),
			),
		),
	];
	function isRequired(name: string) {
		return required.includes(name);
	}
	const evidence = observations.map((check) => `${check.name}${isRequired(check.name) ? "" : " (non-required)"}: ${check.state} ${check.url}`);
	if (required.length === 0) {
		evidence.push("GitHub branch protection and rulesets require no status checks");
	}
	const gates = observations.filter((check) => isRequired(check.name));
	const missing = required.filter((name) => !gates.some((check) => check.name === name));
	evidence.push(...missing.map((name) => `${name}: pending (required check has not reported)`));
	const failures = gates.filter((check) => check.state === "fail");
	const pending = failures.length === 0 && (missing.length > 0 || gates.some((check) => check.state === "pending"));
	return {
		evidence,
		failedChecks: [...new Set(failures.map((check) => check.name))].sort(Order.String),
		head,
		passed: failures.length === 0 && !pending,
		pending,
		...(failures.length === 0
			? {}
			: {
					repairPrompt: `Fix the failing GitHub checks for ${pr} at ${head}:\n${failures.map((check) => `${check.name}: ${check.url}`).join("\n")}`,
				}),
	};
}
