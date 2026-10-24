import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { HEAD, MOVED, PR, resultFixture } from "#test/githubResult.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { finishRecoveryWorker, setLastObservation } from "#test/recoverySteps.ts";

interface AdoptionFault {
	readonly after?: Readonly<Record<string, unknown>>;
	readonly before?: Readonly<Record<string, unknown>>;
	readonly code: RecoveryCase["code"];
	readonly files?: unknown;
	readonly invalidJson?: boolean;
	readonly output?: string;
	readonly reason: string;
}
const faults: readonly AdoptionFault[] = [
	{
		code: "foreign-pr" as const,
		output: `FLEET_HEAD: ${HEAD}\nFLEET_PR: https://github.com/other/repository/pull/7`,
		reason: "Reported PR must belong to the host repository",
	},
	{
		before: { base: { ref: "other", sha: HEAD } },
		code: "fleet-invalid" as const,
		reason: "Reported PR must be open or merged and target the configured repository branch",
	},
	{ before: { head: { sha: MOVED } }, code: "worker-report-head-moved" as const, reason: "PR head moved after the worker report" },
	{
		before: { head: { sha: MOVED }, merged: true, state: "closed" },
		code: "worker-report-merged-head-mismatch" as const,
		reason: "Merged PR head differs from the reported head; inspect delivery before accepting this work",
	},
	{ before: { "changed_files": 2 }, code: "fleet-stale" as const, reason: "PR changed paths moved during observation" },
	{ code: "fleet-integration" as const, files: [[]], reason: "GitHub returned an incomplete changed-path observation" },
	{ code: "fleet-integration" as const, invalidJson: true, reason: "GitHub observation failed or returned invalid data" },
	{ code: "fleet-invalid" as const, files: [[{ filename: "src/outside.ts" }]], reason: "Result needs evidence and known reserved scope" },
];
export function recoveryAdoptionCases(): readonly RecoveryCase[] {
	return faults.map((fault) => {
		const healthy = { "changed_files": 1, head: { sha: HEAD }, merged: false, state: "open" };
		const before: Record<string, unknown> = { ...healthy, ...fault.before };
		const after: Record<string, unknown> = {
			...healthy,
			...(["worker-report-head-moved", "worker-report-merged-head-mismatch"].includes(fault.code) ? fault.before : fault.after),
		};
		const options = { after, before, files: fault.files ?? [[{ filename: "src/one.ts" }]], invalidJson: fault.invalidJson ?? false };
		const reader = resultFixture(options);
		const staleReport = ["worker-report-head-moved", "worker-report-merged-head-mismatch"].includes(fault.code);
		return {
			code: fault.code,
			enter: Effect.fnUntraced(function* (ctx) {
				const output = fault.output ?? `FLEET_HEAD: ${HEAD}\nFLEET_PR: ${PR}`;
				yield* finishRecoveryWorker(ctx, output);
				if (staleReport) {
					setLastObservation(ctx, { execution: "completed", output });
					yield* (yield* Fleet).reconcile("one");
				}
			}),
			name: `adoption: ${fault.reason}`,
			observe: () => ({ requests: reader.requests.length }),
			options: { resultQuery: reader.adopt },
			recovery: staleReport ? "repair-stale-worker-report" : "adopt-worker-result",
			restore: () =>
				Effect.sync(() => {
					Object.assign(before, healthy);
					Object.assign(after, healthy);
					delete before.base;
					delete after.base;
					options.files = [[{ filename: "src/one.ts" }]];
					options.invalidJson = false;
				}),
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		};
	});
}
