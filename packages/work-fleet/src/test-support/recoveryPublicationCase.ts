import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { Fleet } from "#fleet.ts";
import { lostTurnProvider } from "#test/lostTurnProvider.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { launchRecoveryWorker } from "#test/recoverySteps.ts";
import { WORK_BRANCH, WORK_PR } from "#test/workPublication.ts";

export function recoveryPublicationCase(): RecoveryCase {
	const provider = lostTurnProvider();
	let restored = false;
	return {
		code: "session-turn-missing",
		enter: Effect.fnUntraced(function* () {
			yield* launchRecoveryWorker();
			const fleet = yield* Fleet;
			provider.lose((yield* fleet.get("one")).value.attempts.at(-1)?.sessionId);
			yield* fleet.reconcile("one");
		}),
		name: "missing turn waits for publication evidence before repairing the existing PR",
		options: {
			decorateTransport: provider.decorate,
			lostAcknowledgement: true,
			publicationQuery: () =>
				restored
					? Effect.succeed({ branch: WORK_BRANCH, pullRequest: WORK_PR, remoteBranch: true })
					: Effect.fail(new ServiceUnavailable({ message: "Publication lookup unavailable" })),
		},
		progress: (_context, before, after) => {
			expect(after.stage).toBe("executing");
			expect(after.attempts.at(-1)?.role).toBe("repair");
			expect(after.attempts.at(-1)?.sessionId).not.toBe(before.attempts.at(-1)?.sessionId);
			expect(after.attempts.at(-1)?.prompt).toContain(WORK_PR);
		},
		restore: () =>
			Effect.sync(() => {
				restored = true;
			}),
		sites: ['engine/recoverMissingTurn.ts: "session-turn-missing"'],
	};
}
