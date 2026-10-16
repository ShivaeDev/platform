import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { makeGithubChecks } from "#host/githubChecks.ts";
import { githubDelivery } from "#host/githubDelivery.ts";
import { HEAD, PR, resultFixture } from "#test/githubResult.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { finishRecoveryReview, finishRecoveryWorker } from "#test/recoverySteps.ts";

export function recoveryBoundaryCases(): readonly RecoveryCase[] {
	const adoption = resultFixture({ after: { "changed_files": 1 }, before: { "changed_files": 1 }, files: [[{ filename: "src/one.ts" }]] });
	let restored = false;
	const checks = makeGithubChecks(() => Effect.succeed("[]"));
	function readDelivery() {
		return restored
			? Effect.succeed({ headRefOid: HEAD, mergeCommit: { oid: HEAD }, mergedAt: "2026-01-01", state: "MERGED", url: PR })
			: Effect.fail(new ServiceUnavailable({ message: "PR delivery observation failed; check GitHub CLI access and response" }));
	}

	return [
		{
			code: "fleet-invalid" as const,
			enter: finishRecoveryWorker,
			name: "nonterminal adoption evidence",
			options: { resultQuery: (work, observation) => adoption.adopt(work, { ...observation, execution: restored ? "completed" : "running" }) },
			progress: (_ctx, _before, after) => {
				expect(after.result?.head).toBe(HEAD);
				expect(after.attempts.at(-1)?.role).toBe("reviewer");
			},
			restore: () =>
				Effect.sync(() => {
					restored = true;
				}),
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
		{
			code: "fleet-integration" as const,
			enter: finishRecoveryReview,
			name: "no-change cannot use PR checks",
			options: {
				checksQuery: (result) =>
					restored ? Effect.succeed({ evidence: ["Configured no-change validation"], head: result.head, passed: true }) : checks(result),
				resultQuery: () => Effect.succeed({ evidence: ["Criteria already met"], head: HEAD, kind: "no-change" }),
			},
			progress: (_ctx, _before, after) => {
				expect(after.stage).toBe("completed");
				expect(after.result?.kind).toBe("no-change");
			},
			restore: () =>
				Effect.sync(() => {
					restored = true;
				}),
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
		{
			code: "checks-result-invalid" as const,
			enter: finishRecoveryReview,
			name: "malformed adopted commit",
			options: {
				checksQuery: checks,
				deliveryQuery: () => Effect.succeed(undefined),
				resultQuery: () => Effect.succeed({ head: "short", kind: "change", paths: ["src/one.ts"], pr: PR }),
			},
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
		{
			code: "delivery-pr-required" as const,
			enter: finishRecoveryReview,
			name: "malformed adopted PR URL",
			options: {
				checksQuery: (result) => Effect.succeed({ evidence: ["Configured validation"], head: result.head, passed: true }),
				deliveryQuery: githubDelivery("/synthetic", () => Effect.succeed({})),
				resultQuery: () => Effect.succeed({ head: HEAD, kind: "change", paths: ["src/one.ts"], pr: "https://example.invalid/pr/7" }),
			},
			sites: ["engine/observeDeliveryFailure.ts: failureCode(error)"],
		},
		{
			code: "fleet-integration" as const,
			enter: finishRecoveryReview,
			name: "delivery reader unavailable",
			options: { deliveryQuery: githubDelivery("/synthetic", readDelivery) },
			progress: (_ctx, _before, after) => {
				expect(after.stage).toBe("completed");
			},
			restore: () =>
				Effect.sync(() => {
					restored = true;
				}),
			sites: ["engine/observeDeliveryFailure.ts: failureCode(error)"],
		},
	];
}
