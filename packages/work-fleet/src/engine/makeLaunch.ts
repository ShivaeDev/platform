import { Effect } from "effect";
import { admit } from "#admit.ts";
import { launchReceipt } from "#engine/launchReceipt.ts";
import { launchRecord } from "#engine/launchRecord.ts";
import type { EngineState } from "#engine/makeState.ts";
import { submissionFailure } from "#engine/submissionFailure.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import type { DecisionResponse } from "#policy.ts";
import { reportPrompt } from "#prompt/worker.ts";
import type { Versioned } from "#storage/model.ts";
export function makeLaunch(state: EngineState) {
	const { store, board, policy, sessions, load, save, decision } = state;
	return Effect.fn("Fleet.launch")(function* (
		stored: Versioned<FleetRecord>,
		role: "worker" | "repair",
		prompt: string,
		continuation?: { readonly sessionId: string; readonly responses: readonly DecisionResponse[] },
	) {
		const workerPrompt = stored.value.deliverable === "report" ? reportPrompt(prompt) : prompt;
		const original = yield* launchReceipt(stored.value, role);
		const sessionId = continuation?.sessionId ?? (role === "repair" ? original?.sessionId : undefined);
		const work = yield* board.get(stored.value.workId);
		if (work.revision !== stored.value.boardRevision) {
			return yield* decision(stored, "Board context changed after preparation", "Approve and prepare the current scope");
		}
		const quota = yield* policy.refreshQuota === undefined ? Effect.succeed(policy.quota) : policy.refreshQuota();
		yield* admit(
			work,
			(yield* store.list()).map(({ value }) => value),
			{ ...policy, quota },
			board.get,
		);
		const settings = { ...policy.launch, ...stored.value.launch };
		const attempt: Attempt = {
			operationId: policy.operationId(),
			prompt: workerPrompt,
			role,
			settings,
			...(sessionId === undefined ? {} : { sessionId }),
			status: "submitting",
			submittedAt: policy.now(),
		};
		const record = launchRecord(stored.value, role, policy.now(), continuation?.responses);
		const intent = yield* save(
			stored,
			{ ...record, attempts: [...record.attempts, attempt], blocker: undefined, stage: "executing" },
			{ quota, role },
		);
		const submitted =
			sessionId === undefined
				? sessions.start({ cwd: stored.value.cwd, operationId: attempt.operationId, prompt: workerPrompt, settings })
				: sessions.continue({ operationId: attempt.operationId, prompt: workerPrompt, sessionId, settings });
		yield* submitted.pipe(
			Effect.catch((error) =>
				submissionFailure(state, intent.value.workId, attempt.operationId, error, "Restore provider access and retry this approved work"),
			),
		);
		return yield* load(stored.value.workId);
	});
}
