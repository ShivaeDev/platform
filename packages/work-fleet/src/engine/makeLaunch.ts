import { Effect } from "effect";
import { admit } from "#admit.ts";
import { continuedRecord } from "#engine/continuedRecord.ts";
import { launchReceipt } from "#engine/launchReceipt.ts";
import type { EngineState } from "#engine/makeState.ts";
import { submissionFailure } from "#engine/submissionFailure.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";
export function makeLaunch(state: EngineState) {
	const { store, board, policy, sessions, load, save, decision } = state;
	return Effect.fn("Fleet.launch")(function* (stored: Versioned<FleetRecord>, role: "worker" | "repair", prompt: string) {
		const original = yield* launchReceipt(stored.value, role);
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
		const attempt: Attempt = {
			operationId: policy.operationId(),
			prompt,
			role,
			...(role === "repair" && original !== undefined ? { sessionId: original.sessionId } : {}),
			status: "submitting",
			submittedAt: policy.now(),
		};
		const record =
			role === "repair" && ["needs-human", "completed"].includes(stored.value.stage) ? continuedRecord(stored.value, policy.now()) : stored.value;
		const intent = yield* save(
			stored,
			{ ...record, attempts: [...record.attempts, attempt], blocker: undefined, stage: "executing" },
			{ quota, role },
		);
		const settings = { ...policy.launch, ...stored.value.launch };
		const submitted =
			role === "repair" && original !== undefined
				? sessions.continue({ operationId: attempt.operationId, prompt, sessionId: original.sessionId, settings })
				: sessions.start({ cwd: stored.value.cwd, operationId: attempt.operationId, prompt, settings });
		yield* submitted.pipe(Effect.catch(submissionFailure(state, intent.value.workId, attempt.operationId)));
		return yield* load(stored.value.workId);
	});
}
