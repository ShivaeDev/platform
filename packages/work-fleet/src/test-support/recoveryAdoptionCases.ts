import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { HEAD, MOVED, PR, resultFixture } from "#test/githubResult.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { finishRecoveryWorker, setLastObservation } from "#test/recoverySteps.ts";

interface AdoptionFault {
	readonly after?: Readonly<Record<string, unknown>>;
	readonly before?: Readonly<Record<string, unknown>>;
	readonly files?: unknown;
	readonly invalidJson?: boolean;
	readonly output?: string;
	readonly reason: string;
}
const faults: readonly AdoptionFault[] = [
	{ output: `FLEET_HEAD: ${HEAD}\nFLEET_PR: https://github.com/other/repository/pull/7`, reason: "Reported PR must belong to the host repository" },
	{ before: { base: { ref: "other", sha: HEAD } }, reason: "Reported PR must be open or merged and target the configured repository branch" },
	{ before: { head: { sha: MOVED } }, reason: "PR head moved after the worker report" },
	{
		before: { head: { sha: MOVED }, merged: true, state: "closed" },
		reason: "Merged PR head differs from the reported head; inspect delivery before accepting this work",
	},
	{ before: { base: { ref: "main", sha: MOVED } }, reason: "PR base or changed paths moved during observation" },
	{ files: [[]], reason: "GitHub returned an incomplete changed-path observation" },
	{ invalidJson: true, reason: "GitHub observation failed or returned invalid data" },
	{ files: [[{ filename: "src/outside.ts" }]], reason: "Result needs evidence and known reserved scope" },
];
export function recoveryAdoptionCases(): readonly RecoveryCase[] {
	return faults.map((fault) => {
		const healthy = { "changed_files": 1, head: { sha: HEAD }, merged: false, state: "open" };
		const before: Record<string, unknown> = { ...healthy, ...fault.before };
		const after: Record<string, unknown> = { ...healthy, ...(fault.reason.includes("head") ? fault.before : fault.after) };
		const options = { after, before, files: fault.files ?? [[{ filename: "src/one.ts" }]], invalidJson: fault.invalidJson ?? false };
		const reader = resultFixture(options);
		const staleReport = fault.reason.includes("head") && fault.reason !== "Result needs evidence and known reserved scope";
		return {
			enter: Effect.fnUntraced(function* (ctx) {
				const output = fault.output ?? `FLEET_HEAD: ${HEAD}\nFLEET_PR: ${PR}`;
				yield* finishRecoveryWorker(ctx, output);
				if (staleReport) {
					setLastObservation(ctx, { execution: "completed", output });
					yield* (yield* Fleet).reconcile("one");
				}
			}),
			name: `adoption: ${fault.reason}`,
			options: { resultQuery: reader.adopt },
			progress: (_ctx, _before, afterRecord) => {
				if (staleReport) {
					expect(afterRecord.stage).toBe("executing");
					expect(afterRecord.attempts.length).toBeGreaterThan(_before.attempts.length);
					expect(afterRecord.attempts.at(-1)?.receipt?.sessionId).toBe(_before.attempts.at(-1)?.receipt?.sessionId);
				} else {
					expect(afterRecord.result?.head).toBe(HEAD);
					expect(afterRecord.attempts.at(-1)?.role).toBe("reviewer");
				}
				expect(reader.requests.length).toBeGreaterThan(0);
			},
			reason: fault.reason,
			restore: () =>
				Effect.sync(() => {
					Object.assign(before, healthy);
					Object.assign(after, healthy);
					delete before.base;
					delete after.base;
					options.files = [[{ filename: "src/one.ts" }]];
					options.invalidJson = false;
				}),
			sites: ["engine/reconcileCommand.ts: failureMessage(error)"],
		};
	});
}
