import { Effect } from "effect";
import { admit } from "#admit.ts";
import { authorizeBriefContext } from "#engine/boardBrief.ts";
import { launchInput } from "#engine/launchInput.ts";
import { launchObservationRetries } from "#engine/launchObservationRetries.ts";
import { launchRecord } from "#engine/launchRecord.ts";
import { localOnlyCriteria } from "#engine/localOnlyCriteria.ts";
import type { EngineState } from "#engine/makeState.ts";
import { releaseClosedPreparation } from "#engine/releaseClosedPreparation.ts";
import { submitLaunch } from "#engine/submitLaunch.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import type { DecisionResponse } from "#policy.ts";
import { policyGuidance } from "#policyGuidance.ts";
import { reportPrompt, withWorkerGuidance } from "#prompt/worker.ts";
import type { Versioned } from "#storage/model.ts";
export function makeLaunch(state: EngineState) {
	const { store, board, policy, sessions, load, save } = state;
	return Effect.fn("Fleet.launch")(function* (
		input: Versioned<FleetRecord>,
		role: "worker" | "repair",
		prompt: string,
		continuation?: {
			readonly sessionId: string;
			readonly responses: readonly DecisionResponse[];
			readonly stallRecovery?: Attempt["stallRecovery"];
			readonly observationRetries?: number;
		},
	) {
		const stored = input;
		const work = yield* board.get(stored.value.workId, { fresh: true });
		const released = yield* releaseClosedPreparation(state, stored, work);
		if (released !== undefined) {
			return released;
		}
		yield* authorizeBriefContext(stored.value, work);
		const localOnly = yield* localOnlyCriteria(work, policy.localOnlyBoardPath);
		if (localOnly !== undefined) {
			return yield* state.decision(
				stored,
				"incomplete-context",
				localOnly,
				"Edit the criteria to use repository fixtures or other data available to Cloud workers, then dispatch again",
			);
		}
		if (stored.value.launchRetry !== undefined && policy.now() < stored.value.launchRetry.retryAt) {
			return stored;
		}
		const {
			checkFailures,
			prompt: retryPrompt,
			role: launchRole,
			sessionId,
			settings: retrySettings,
		} = yield* launchInput(stored.value, role, continuation?.sessionId);
		const workerPrompt = answeredPrompt(stored.value, prompt, retryPrompt, yield* policyGuidance(policy, "worker"));
		const quota = yield* policy.refreshQuota === undefined ? Effect.succeed(policy.quota) : policy.refreshQuota();
		yield* admit(
			work,
			(yield* store.list()).map(({ value }) => value),
			{ ...policy, quota },
			board.get,
		);
		const settings = retrySettings ?? { ...policy.launch, ...stored.value.launch };
		const attempt: Attempt = {
			checkFailures,
			observationRetries: launchObservationRetries(stored.value, continuation?.observationRetries),
			operationId: policy.operationId(),
			prompt: workerPrompt,
			providerFailures: stored.value.launchRetry?.rejections,
			role: launchRole,
			settings,
			stallRecovery: continuation?.stallRecovery,
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
				pendingAnswers: undefined,
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

export function launchPrompt(record: FleetRecord, prompt: string, retryPrompt: string | undefined, guidance?: string): string {
	const queuedPrompt = retryPrompt ?? prompt;
	return withWorkerGuidance(record.deliverable === "report" && retryPrompt === undefined ? reportPrompt(queuedPrompt) : queuedPrompt, guidance);
}

function answeredPrompt(record: FleetRecord, prompt: string, retryPrompt: string | undefined, guidance?: string) {
	const queuedPrompt = [retryPrompt ?? prompt, ...(record.pendingAnswers ?? [])].join("\n\n");
	return launchPrompt(record, queuedPrompt, retryPrompt === undefined ? undefined : queuedPrompt, guidance);
}
