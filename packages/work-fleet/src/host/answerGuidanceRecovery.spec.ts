import { expect } from "@effect/vitest";
import { answers } from "#test/answerHost.ts";

const TEXT = "Preserve the empty state.";

answers.it("a waiting answer converted to guidance queues once after shutdown during its handoff", [], function* (host) {
	yield* host.dispatch();
	const { decision } = yield* host.question();
	yield* host.seedRecordedRequest(decision, TEXT, false);
	const responseId = yield* host.publishResponse(decision, "Continue the implementation.", false);
	yield* host.resolve(decision.id, responseId);
	expect((yield* host.get()).stage).toBe("executing");
	yield* host.stop();
	const handoff = yield* host.pauseCompletion();
	yield* host.start();
	yield* handoff.blocked;
	yield* host.stop();
	expect(yield* host.storedRequests()).toMatchObject([{ "decision_id": decision.id, text: TEXT }]);
	yield* handoff.release;
	yield* host.start();
	const current = yield* host.applied();
	expect(current.pendingAnswers).toEqual([TEXT]);
	expect(yield* host.storedRequests()).toEqual([]);
});
