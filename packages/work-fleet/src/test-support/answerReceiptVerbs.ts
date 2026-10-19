import { Effect, Schedule } from "effect";
import { Fleet } from "#fleet.ts";
import { recordDecisionResponse } from "#host/recordDecisionResponse.ts";
import { withDecisionResponses } from "#host/releaseWork.ts";
import type { Decision, DecisionResponse } from "#policy.ts";
import type { SessionFailure } from "#session/schema.ts";
import { type AnswerRequest, answerStore } from "#storage/answerStore.ts";
import type { AnswerHostEngine } from "#test/AnswerHostEngine.ts";
import { answerCompletionFailure } from "#test/answerCompletionFailure.ts";
import { answerQueueFailure, answerRecordingFailure } from "#test/answerRecordingFailure.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { pauseAnswerCompletion } from "#test/busyAdmission.ts";
import { answerWorker, askWorker } from "#test/workerQuestion.ts";

export function answerReceiptVerbs(engine: AnswerHostEngine, tell: (line: string) => void) {
	return {
		boardReceipts: () => boardHttpFiles(engine.host.host.boardDir).receipts(),
		defer: (decision: Decision, type: "clarify" | "not_now") => answerWorker(engine.host.host.boardDir, decision, `response.worker.${type}`, type),
		failCompletion: () => answerCompletionFailure(engine.host.host),
		failQueue: () => answerQueueFailure(engine.host.host),
		failRecording: (fail: boolean) => answerRecordingFailure(engine.host.host, fail),
		holdBoardReadsOnce: (blocker: string, workId = "one") => {
			tell(`hold Fleet's Board reads once ${workId} shows "${blocker}"`);
			return engine.resolution.arm(engine.host.host, workId, blocker);
		},
		pauseCompletion: (workId = "one") => {
			tell(`pause answer completion for ${workId}`);
			return pauseAnswerCompletion(engine.host.host, workId);
		},
		providerSessions: () => engine.host.provider.launched.length,
		providerTurns: () => engine.host.provider.observations.size,
		publishResponse: (decision: Decision, text: string, release: boolean) => {
			if (decision.published === undefined) {
				throw new Error("The decision has no published question");
			}
			return withDecisionResponses(
				engine.host.host,
				recordDecisionResponse(engine.host.host.boardDir, { ...decision, published: decision.published }, release ? "release" : "retry", text),
			).pipe(Effect.provideContext(engine.running.context));
		},
		question: (workId = "one") => {
			tell(`the worker asks a question for ${workId}`);
			return askWorker(engine.host.provider, workId).pipe(Effect.provideService(Fleet, engine.fleet));
		},
		rejectNextTurn: (failure: SessionFailure) => engine.host.provider.rejectNextTurn(failure),
		requestsFinished: (workId = "one") => {
			tell(`wait until the answer requests for ${workId} finish`);
			return answerStore(engine.host.host.namespace).pipe(
				Effect.flatMap((store) => store.list(workId)),
				Effect.repeat({ schedule: Schedule.spaced("10 millis"), until: (requests) => requests.length === 0 }),
				Effect.asVoid,
				Effect.timeout("10 seconds"),
			);
		},
		// Recovery starts after a durable commit and before the daemon notices it.
		seedRecordedRequest: (decision: Decision, text: string, release: boolean, workId = "one") =>
			answerStore(engine.host.host.namespace).pipe(Effect.flatMap((store) => store.accept(workId, decision, text, release))),
		seedResponseIdentity: (request: AnswerRequest, response: Pick<DecisionResponse, "decisionId" | "responseId">) =>
			answerStore(engine.host.host.namespace).pipe(Effect.flatMap((store) => store.recordResponse(request, response))),
		storedRequests: (workId = "one") => answerStore(engine.host.host.namespace).pipe(Effect.flatMap((store) => store.list(workId))),
	};
}
