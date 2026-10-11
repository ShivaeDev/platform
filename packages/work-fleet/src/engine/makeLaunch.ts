import { Effect } from "effect";
import { admit } from "#admit.ts";
import { capacityRetry } from "#engine/capacityRetry.ts";
import { launchInput } from "#engine/launchInput.ts";
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
		if (stored.value.launchRetry !== undefined && policy.now() < stored.value.launchRetry.retryAt) {
			return stored;
		}
		const {
			prompt: retryPrompt,
			role: launchRole,
			sessionId,
			settings: retrySettings,
		} = yield* launchInput(stored.value, role, continuation?.sessionId);
		const workerPrompt = retryPrompt ?? (stored.value.deliverable === "report" ? reportPrompt(prompt) : prompt);
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
		const settings = retrySettings ?? { ...policy.launch, ...stored.value.launch };
		const attempt: Attempt = {
			operationId: policy.operationId(),
			prompt: workerPrompt,
			role: launchRole,
			settings,
			...(sessionId === undefined ? {} : { sessionId }),
			status: "submitting",
			submittedAt: policy.now(),
		};
		const record = launchRecord(stored.value, launchRole, policy.now(), continuation?.responses);
		const intent = yield* save(
			stored,
			{
				...record,
				admissionReady: true,
				attempts: [...record.attempts, attempt],
				blocker: undefined,
				launchRetry: undefined,
				mergeAreasReleased: undefined,
				mergeReadyAt: undefined,
				mergeReadyHead: undefined,
				stage: "executing",
			},
			{ quota, role: launchRole },
		);
		const submitted =
			sessionId === undefined
				? sessions.start({ cwd: stored.value.cwd, operationId: attempt.operationId, prompt: workerPrompt, settings })
				: sessions.continue({ operationId: attempt.operationId, prompt: workerPrompt, sessionId, settings });
		yield* submitted.pipe(
			Effect.catch((error) =>
				capacityRetry(state, stored.value, attempt.operationId, error).pipe(
					Effect.flatMap((retrying) =>
						retrying
							? Effect.void
							: submissionFailure(state, intent.value.workId, attempt.operationId, error, "Restore provider access and retry this approved work"),
					),
				),
			),
		);
		return yield* load(stored.value.workId);
	});
}
