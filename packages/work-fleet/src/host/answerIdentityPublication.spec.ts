import { expect } from "@effect/vitest";
import { answers } from "#test/answerHost.ts";

const TEXT = "Use PostgreSQL.";

answers.it("an interrupted response identity commit cannot publish an answer that recovery queues again", [], function* (host) {
	yield* host.dispatch();
	const { decision } = yield* host.question();
	yield* host.seedRecordedRequest(decision, TEXT, false);
	yield* host.stop();
	const identity = yield* host.pauseCompletion();
	yield* host.start();
	yield* identity.blocked;
	yield* host.reconcile();
	const receiptsBeforeCommit = host.boardReceipts();
	yield* host.stop();
	expect(yield* host.storedRequests()).toMatchObject([{ "response_decision_id": null, "response_id": null, text: TEXT }]);
	yield* identity.release;
	yield* host.start();
	const current = yield* host.applied();
	expect(current.step).toBe("working");
	expect(current.pendingAnswers).toBeUndefined();
	expect(current.responses).toMatchObject([{ action: "continue", boardAcknowledged: true, decisionId: decision.id }]);
	expect(host.providerLaunches()).toEqual([current.attempts[0]?.operationId]);
	expect(host.providerReceipts()).toEqual(current.attempts.map((attempt) => attempt.receipt));
	expect(yield* host.storedRequests()).toEqual([]);
	expect(receiptsBeforeCommit).toEqual([]);
});
