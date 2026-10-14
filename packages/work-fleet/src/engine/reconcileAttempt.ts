import { Effect } from "effect";
import { briefApproved, briefChanged } from "#engine/boardBrief.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import { reportPrompt } from "#prompt/worker.ts";
import type { Versioned } from "#storage/model.ts";

export function reconcileAttempt({ sessions, policy, board }: EngineState) {
	return Effect.fn("Fleet.reconcileAttempt")(function* (stored: Versioned<FleetRecord>, attempt: Attempt) {
		const work = yield* board.get(stored.value.workId);
		const authorized = briefApproved(work) && !briefChanged(stored.value, work);
		const preparedPrompt = stored.value.deliverable === "report" ? reportPrompt(stored.value.prompt) : stored.value.prompt;
		const prompt = attempt.prompt ?? (attempt.role === "worker" ? preparedPrompt : undefined);
		return yield* sessions.reconcile({
			operationId: attempt.operationId,
			sessionId: attempt.sessionId,
			...(prompt === undefined || !authorized || attempt.submissionUncertain
				? {}
				: {
						resume: {
							...(attempt.role === "reviewer" ? { access: "read-only" as const } : {}),
							prompt,
							settings: attempt.settings ?? { ...policy.launch, ...stored.value.launch },
						},
					}),
		});
	});
}
