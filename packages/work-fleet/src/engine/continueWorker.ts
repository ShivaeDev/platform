import { Effect } from "effect";
import { admit } from "#admit.ts";
import type { EngineState } from "#engine/makeState.ts";
import { submissionFailure } from "#engine/submissionFailure.ts";
import { type Attempt, executing, type FleetRecord } from "#model.ts";
import { type DecisionResponse, FleetFailure } from "#policy.ts";
import { reportPrompt } from "#prompt/worker.ts";
import type { Versioned } from "#storage/model.ts";

export function continueWorker(state: EngineState) {
	return Effect.fn("Fleet.continueWorker")(function* (stored: Versioned<FleetRecord>, responses: readonly DecisionResponse[], prompt: string) {
		const workerPrompt = stored.value.deliverable === "report" ? reportPrompt(prompt) : prompt;
		const worker = stored.value.decision?.worker;
		const latest = stored.value.attempts.at(-1);
		if (
			worker === undefined
			|| latest?.receipt?.sessionId !== worker.sessionId
			|| latest.receipt.turnId !== worker.turnId
			|| latest.role === "reviewer"
			|| latest.status !== "completed"
			|| executing(stored.value)
		) {
			return yield* Effect.fail(new FleetFailure({ message: "Confirm the exact question turn is terminal before continuing", reason: "denied" }));
		}
		const work = yield* state.board.get(stored.value.workId);
		if (work.revision !== stored.value.boardRevision) {
			return yield* Effect.fail(new FleetFailure({ message: "Board context changed before worker continuation", reason: "stale" }));
		}
		const quota = yield* state.policy.refreshQuota === undefined ? Effect.succeed(state.policy.quota) : state.policy.refreshQuota();
		yield* admit(
			work,
			(yield* state.store.list()).map(({ value }) => value),
			{ ...state.policy, quota },
			state.board.get,
		);
		const attempt: Attempt = {
			operationId: state.policy.operationId(),
			prompt: workerPrompt,
			role: latest.role,
			sessionId: worker.sessionId,
			status: "submitting",
			submittedAt: state.policy.now(),
		};
		yield* state.save(
			stored,
			{
				...stored.value,
				attempts: [...stored.value.attempts, attempt],
				blocker: undefined,
				decision: undefined,
				responses,
				stage: "executing",
			},
			{ quota, role: attempt.role },
		);
		yield* state.sessions
			.continue({
				operationId: attempt.operationId,
				prompt: workerPrompt,
				sessionId: worker.sessionId,
				settings: { ...state.policy.launch, ...stored.value.launch },
			})
			.pipe(
				Effect.catch((error) =>
					submissionFailure(state, stored.value.workId, attempt.operationId, error, "Restore provider access and inspect the recorded answer"),
				),
			);
		return yield* state.load(stored.value.workId);
	});
}
