import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { makeGithubChecks } from "#host/githubChecks.ts";
import { HEAD, MOVED } from "#test/githubResult.ts";
import type { RecoveryCase, RecoveryContext } from "#test/recoveryCase.ts";
import { finishRecoveryReview } from "#test/recoverySteps.ts";

const healthyChecks = JSON.stringify([
	{
		"check_runs": [
			{
				conclusion: "success",
				"details_url": null,
				"head_sha": HEAD,
				"html_url": "https://example.invalid/check",
				name: "test",
				status: "completed",
			},
		],
	},
]);
export function recoveryChecksCases(): readonly RecoveryCase[] {
	return [
		{ body: "invalid", code: "fleet-integration" as const, endpoint: "check-runs", reason: "GitHub check runs are unavailable or invalid" },
		{ body: "invalid", code: "fleet-integration" as const, endpoint: "status?", reason: "GitHub commit statuses are unavailable or invalid" },
		{
			body: JSON.stringify([{ sha: MOVED, statuses: [] }]),
			code: "fleet-integration" as const,
			endpoint: "status?",
			reason: "GitHub checks returned evidence for a different commit SHA",
		},
	].map((fault) => {
		let restored = false;
		let requests = 0;
		const checks = makeGithubChecks((endpoint) =>
			Effect.sync(() => {
				requests += 1;
				if (!restored && endpoint.includes(fault.endpoint)) {
					return fault.body;
				}
				if (endpoint.includes("/rules/branches/")) {
					return "[[]]";
				}
				return endpoint.includes("check-runs") ? healthyChecks : JSON.stringify([{ sha: HEAD, statuses: [] }]);
			}),
		);
		return {
			code: fault.code,
			enter: finishRecoveryReview,
			name: fault.reason,
			options: { checksQuery: checks },
			progress: (_ctx, _before, after) => {
				expect(requests).toBe(0);
				expect(after.checks).toBeUndefined();
				expect(after.stage).toBe("released");
			},
			restore: (ctx: RecoveryContext) =>
				Effect.sync(() => {
					restored = true;
					ctx.github.state.status = "MERGED";
					requests = 0;
				}),
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		};
	});
}
