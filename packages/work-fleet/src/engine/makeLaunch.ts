import { Effect } from "effect";
import { admit } from "#admit.ts";
import { authorizeBrief, briefChanged, briefUpdate, refreshedBrief } from "#engine/boardBrief.ts";
import { launchInput } from "#engine/launchInput.ts";
import { launchRecord } from "#engine/launchRecord.ts";
import type { EngineState } from "#engine/makeState.ts";
import { submitLaunch } from "#engine/submitLaunch.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import type { BoardWork, DecisionResponse } from "#policy.ts";
import { reportPrompt, withWorkerGuidance } from "#prompt/worker.ts";
import type { Versioned } from "#storage/model.ts";
export function makeLaunch(state: EngineState) {
	const { store, board, policy, sessions, load, save } = state;
	return Effect.fn("Fleet.launch")(function* (
		input: Versioned<FleetRecord>,
		role: "worker" | "repair",
		prompt: string,
		continuation?: { readonly sessionId: string; readonly responses: readonly DecisionResponse[] },
	) {
		let stored = input;
		const work = yield* board.get(stored.value.workId);
		yield* authorizeBrief(work);
		if (stored.value.launchRetry !== undefined && policy.now() < stored.value.launchRetry.retryAt) {
			return stored;
		}
		const {
			prompt: retryPrompt,
			role: launchRole,
			sessionId,
			settings: retrySettings,
		} = yield* launchInput(stored.value, role, continuation?.sessionId);
		const workerPrompt = launchPrompt(stored.value, work, prompt, retryPrompt, policy.workerGuidance);
		stored = { ...stored, value: refreshedBrief(stored.value, work) };
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
		yield* save(
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
		yield* submitLaunch(state, stored.value, attempt.operationId, submitted);
		return yield* load(stored.value.workId);
	});
}

function launchPrompt(record: FleetRecord, work: BoardWork, prompt: string, retryPrompt: string | undefined, guidance?: string): string {
	const queuedPrompt = retryPrompt ?? prompt;
	const currentPrompt = briefChanged(record, work) ? `${queuedPrompt}\n\n${briefUpdate(record, work)}` : queuedPrompt;
	return retryPrompt === undefined
		? withWorkerGuidance(record.deliverable === "report" ? reportPrompt(currentPrompt) : currentPrompt, guidance)
		: currentPrompt;
}
