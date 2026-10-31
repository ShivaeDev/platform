import { expect } from "@effect/vitest";
import { approvedWork, host } from "#test/hostStory.ts";
import { refusal } from "#test/refusal.ts";

for (const worker of [false, true]) {
	for (const release of [false, true]) {
		host.it(
			`an oversized answer is refused and leaves no response, with worker=${worker}, release=${release}`,
			[approvedWork(["one"])],
			function* (daemon) {
				const started = yield* daemon.dispatch("one");
				daemon.finishTurn(started, worker ? "FLEET_QUESTION: Which storage should I use?" : undefined);
				const waiting = yield* daemon.reconcile("one");

				const answered = yield* refusal(daemon.answer("one", "x".repeat(32_769), release));

				expect(answered).toMatch(/^bad request: .*32768/u);
				expect({ receipts: daemon.receiptFiles(), responses: daemon.responseFiles() }).toEqual({ receipts: [], responses: [] });
				const rejected = yield* daemon.get("one");
				expect({ decision: rejected.decision, responses: rejected.responses }).toEqual({ decision: waiting.decision, responses: waiting.responses });
			},
		);

		host.it(
			`after an oversized refusal, an answer at the size limit applies with worker=${worker}, release=${release}`,
			[approvedWork(["one"])],
			function* (daemon) {
				const started = yield* daemon.dispatch("one");
				daemon.finishTurn(started, worker ? "FLEET_QUESTION: Which storage should I use?" : undefined);
				yield* daemon.reconcile("one");
				expect(yield* refusal(daemon.answer("one", "x".repeat(32_769), release))).toMatch(/^bad request: /u);
				const text = "v".repeat(32_768);
				const applied = worker ? "working" : "adopting";

				const answered = yield* daemon.answer("one", text, release);

				expect(answered).toMatchObject({
					responses: expect.arrayContaining([expect.objectContaining({ boardAcknowledged: true })]),
					step: release ? "released" : applied,
				});
				expect(daemon.receiptFiles().map((file) => daemon.readBoard(file))).toEqual([expect.stringContaining('"disposition":"applied"')]);
				if (worker && !release) {
					expect(answered.attempts.at(-1)).toMatchObject({ prompt: text, receipt: { sessionId: started.attempts[0]?.receipt?.sessionId } });
				}
			},
		);
	}
}
