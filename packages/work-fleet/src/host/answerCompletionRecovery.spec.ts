import { expect } from "@effect/vitest";
import { ANSWER_RECORDED } from "#attention.ts";
import { answers } from "#test/answerHost.ts";

answers.it("a pending answer resumes after completion writes recover without restarting the daemon", [], function* (host) {
	yield* host.dispatch();
	const { decision } = yield* host.question();
	const completion = yield* host.failCompletion();
	yield* host.answer("Use PostgreSQL.");
	yield* completion.attempted;
	expect((yield* host.status()).waiting.automation).toMatchObject([{ blocker: ANSWER_RECORDED, workId: "one" }]);
	yield* completion.release;
	const applied = yield* host.applied();
	expect(applied.responses?.filter((response) => response.decisionId === decision.id)).toHaveLength(1);
	expect(applied.pendingAnswers).toBeUndefined();
	expect(host.providerTurns()).toBe(2);
	expect(yield* host.storedRequests()).toEqual([]);
});
