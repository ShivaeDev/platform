import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { admit } from "#admit.ts";
import { enginePolicy } from "#test/enginePolicy.ts";
import type { RecoveryCase, RecoveryContext } from "#test/recoveryCase.ts";
import { finishRecoveryReview } from "#test/recoverySteps.ts";

export function recoveryAdmissionCases(): readonly RecoveryCase[] {
	let context: RecoveryContext | undefined;
	let restored = false;
	return [
		{
			code: "approval-required" as const,
			enter: Effect.fnUntraced(function* (current) {
				context = current;
				yield* finishRecoveryReview(current);
			}),
			name: "production admission rejects an unapproved snapshot",
			options: {
				checksQuery: (result) => {
					if (context === undefined) {
						return Effect.die("Missing recovery context");
					}
					const work = context.fixture.work("one");
					return admit({ ...work, approved: restored }, [], enginePolicy({}), () => Effect.succeed(work)).pipe(
						Effect.as({ evidence: ["Configured checks"], head: result.head, passed: true }),
					);
				},
			},
			progress: (_current, _before, after) => expect(after.stage).toBe("completed"),
			restore: (current) =>
				Effect.sync(() => {
					restored = true;
					current.github.state.status = "MERGED";
				}),
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
	];
}
