import { expect } from "@effect/vitest";
import { ANSWER_RECORDED } from "#attention.ts";
import { answers } from "#test/answerHost.ts";

const QUESTION_AND_ANSWER_TURNS = 2;

answers.it("a pending answer resumes after completion writes recover without restarting the daemon", [], function* (host) {
	yield* host.dispatch();
	const { decision } = yield* host.question();
	const completion = yield* host.failCompletion();
	yield* host.answer("Use PostgreSQL.");
	yield* completion.attempted;
	expect((yield* host.status()).waiting.automation).toMatchObject([{ blocker: ANSWER_RECORDED, workId: "one" }]);
	yield* completion.release;
	const applied = yield* host.applied();
	expect(applied.responses?.map((response) => response.decisionId)).toEqual([decision.id]);
	expect(applied.pendingAnswers).toBeUndefined();
	expect(host.providerTurns()).toBe(QUESTION_AND_ANSWER_TURNS);
	expect(yield* host.storedRequests()).toEqual([]);
});

answers.it("a completion retry leaves an answer that Fleet is still resolving to that resolution", [], function* (host) {
	yield* host.dispatch();
	const { decision } = yield* host.question();
	const completion = yield* host.failCompletion();
	const resolution = yield* host.holdBoardReadsOnce(ANSWER_RECORDED);
	yield* host.answer("Use PostgreSQL.");
	yield* completion.attempted;
	yield* resolution.entered;
	yield* completion.release;
	yield* host.requestsFinished();
	yield* resolution.release;
	const applied = yield* host.applied();
	expect(applied.responses?.map((response) => response.decisionId)).toEqual([decision.id]);
	expect(applied.pendingAnswers).toBeUndefined();
	expect(host.providerTurns()).toBe(QUESTION_AND_ANSWER_TURNS);
});
