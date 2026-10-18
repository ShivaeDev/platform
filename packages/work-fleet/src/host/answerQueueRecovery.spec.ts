import { expect } from "@effect/vitest";
import { ANSWER_RECORDED } from "#attention.ts";
import { answers } from "#test/answerHost.ts";

const messages = ["Keep the loading indicator visible.", "Preserve the empty state."];

answers.it("recorded guidance survives shutdown before admission frees and queues once in order after restart", [], function* (host) {
	const current = yield* host.dispatch();
	yield* host.stop();
	yield* host.start();
	const { release: free } = yield* host.holdAdmission();
	for (const text of messages) {
		const recorded = yield* host.answer(text);
		expect(recorded.blocker).toBe(ANSWER_RECORDED);
	}
	const stored = yield* host.storedRequests();
	expect(stored.map((request) => request.text)).toEqual(messages);
	yield* host.stop();
	yield* free;
	yield* host.start();
	const queued = yield* host.waitForRecord("one", (record) => record.pendingAnswers?.length === messages.length);
	expect(queued.pendingAnswers).toEqual(messages);
	expect(queued.attempts).toEqual(current.attempts);
	expect(yield* host.storedRequests()).toEqual([]);
	expect((yield* host.get()).pendingAnswers).toEqual(messages);
});
