import { expect } from "@effect/vitest";
import { ANSWER_RECORDED } from "#attention.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { answers, answerWork } from "#test/answerHost.ts";
import { refusal } from "#test/refusal.ts";

const TEXT = "Use PostgreSQL.";

for (const release of [false, true]) {
	const kind = release ? "release" : "text";
	const text = release ? "" : TEXT;

	answers.it(`a ${kind} answer while admission is held is recorded and waits on automation`, [], function* (host) {
		yield* host.dispatch();
		yield* host.question();
		yield* host.holdAdmission();

		const recorded = yield* host.answer(text, release);

		const pending = yield* host.status();
		expect({ blocker: recorded.blocker, rendered: renderStatus(pending), waiting: pending.waiting.automation }).toMatchObject({
			blocker: ANSWER_RECORDED,
			rendered: expect.stringContaining(ANSWER_RECORDED),
			waiting: [{ blocker: ANSWER_RECORDED, workId: "one" }],
		});
	});

	answers.it(`repeating a recorded ${kind} answer through the CLI reports it recorded`, [], function* (host) {
		yield* host.dispatch();
		yield* host.question();
		yield* host.holdAdmission();
		yield* host.answer(text, release);

		const repeated = yield* host.cliAnswer("one", text, release);

		expect(repeated).toEqual({ code: 0, stderr: "", stdout: `one waiting (waiting on automation): ${ANSWER_RECORDED}` });
	});

	answers.it(`a competing answer to a recorded ${kind} answer is refused as a conflict`, [], function* (host) {
		yield* host.dispatch();
		yield* host.question();
		yield* host.holdAdmission();
		yield* host.answer(text, release);

		const competing = yield* refusal(host.answer(TEXT, !release));

		expect(competing).toMatch(/^conflict: /u);
	});

	answers.it(`a recorded ${kind} answer applies once admission frees and its recorded blocker clears`, [], function* (host) {
		yield* host.dispatch();
		const { decision } = yield* host.question();
		const { release: free } = yield* host.holdAdmission();
		expect((yield* host.answer(text, release)).blocker).toBe(ANSWER_RECORDED);

		yield* free;

		const answered = yield* host.applied();
		expect({
			blocker: answered.blocker,
			rendered: renderStatus(yield* host.status()),
			responses: answered.responses?.filter(({ decisionId }) => decisionId === decision.id),
		}).toMatchObject({
			blocker: expect.not.stringMatching(ANSWER_RECORDED),
			rendered: expect.not.stringContaining(ANSWER_RECORDED),
			responses: [{ action: release ? "release" : "continue", boardAcknowledged: true }],
		});
	});

	answers.it(`a ${kind} answer whose caller times out still records and applies once recording completes`, [], function* (host) {
		yield* host.dispatch();
		const { decision } = yield* host.question();
		const completion = yield* host.pauseCompletion();
		expect(yield* refusal(host.answer(TEXT, release))).toMatch(
			/^unavailable: Fleet daemon answer one timed out at .+; answer recording is unconfirmed; check status or watch before retrying$/u,
		);
		yield* completion.blocked;

		yield* completion.release;

		const applied = yield* host.applied();
		expect(applied.responses?.filter(({ decisionId }) => decisionId === decision.id)).toMatchObject([
			{ action: release ? "release" : "continue", boardAcknowledged: true },
		]);
	});
}

answers.it("daemon answers share one watched Board response index", [answerWork(["one", "two"])], function* (host) {
	for (const workId of ["one", "two"]) {
		yield* host.dispatch(workId);
		const { decision } = yield* host.question(workId);
		const answered = yield* host.answerAndWait(workId === "one" ? TEXT : "", workId === "two", workId);
		expect(answered.responses?.filter((receipt) => receipt.decisionId === decision.id)).toMatchObject([
			{ action: workId === "two" ? "release" : "continue", boardAcknowledged: true },
		]);
	}
	expect(host.responseIndexSpans()).toEqual(["WorkBoard.searchSnapshot"]);
});
