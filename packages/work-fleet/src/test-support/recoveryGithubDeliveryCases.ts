import { Effect } from "effect";
import { githubDelivery } from "#host/githubDelivery.ts";
import { HEAD, PR } from "#test/githubResult.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { finishRecoveryReview } from "#test/recoverySteps.ts";

export function recoveryGithubDeliveryCases(): readonly RecoveryCase[] {
	return [
		{ code: "fleet-integration" as const, patch: { state: "UNKNOWN" }, reason: "PR delivery observation returned an unknown shape" },
		{ code: "fleet-invalid" as const, patch: { url: `${PR}0` }, reason: "Delivery observation differs from the adopted PR" },
		{ code: "fleet-invalid" as const, patch: { mergedAt: "2026-01-01" }, reason: "PR delivery evidence is inconsistent; inspect the adopted PR" },
	].map((fault) => {
		let restored = false;
		let reads = 0;
		const readPullRequests: string[] = [];
		const healthy = { headRefOid: HEAD, mergeCommit: null, mergedAt: null, state: "OPEN", url: PR };
		const merged = { ...healthy, mergeCommit: { oid: HEAD }, mergedAt: "2026-01-01", state: "MERGED" };
		const delivery = githubDelivery((pr) =>
			Effect.sync(() => {
				reads += 1;
				readPullRequests.push(pr);
				return restored ? merged : { ...healthy, ...fault.patch };
			}),
		);
		return {
			code: fault.code,
			enter: finishRecoveryReview,
			name: fault.reason,
			observe: () => ({ readPullRequests: [...readPullRequests], reads }),
			options: { deliveryQuery: delivery },
			recovery: "observe-valid-delivery",
			restore: () =>
				Effect.sync(() => {
					restored = true;
					reads = 0;
					readPullRequests.length = 0;
				}),
			sites: ["engine/observeDeliveryFailure.ts: failureCode(error)"],
		};
	});
}
