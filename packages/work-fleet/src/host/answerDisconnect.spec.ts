import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { ANSWER_RECORDED } from "#attention.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { answers, answerWork } from "#test/answerHost.ts";

const TEXT = "Use PostgreSQL.";

for (const release of [false, true]) {
	answers.it(`a ${release ? "release" : "text"} answer confirms, rejects a competing answer, and applies once admission frees`, [], function* (host) {
		yield* host.dispatch();
		const { decision } = yield* host.question();
		const { release: free } = yield* host.holdAdmission();
		expect((yield* host.answer(release ? "" : TEXT, release)).blocker).toBe(ANSWER_RECORDED);
		expect(yield* host.cliAnswer("one", release ? "" : TEXT, release).pipe(Effect.timeout("5 seconds"))).toEqual({
			code: 0,
			stderr: "",
			stdout: `one needs-human: ${ANSWER_RECORDED}`,
		});
		const competing = yield* host.answer(TEXT, !release).pipe(Effect.flip);
		expect(competing._tag).toBe("Conflict");
		const pending = yield* host.status();
		expect(pending.waiting.automation).toMatchObject([{ blocker: ANSWER_RECORDED, workId: "one" }]);
		expect(renderStatus(pending)).toContain(ANSWER_RECORDED);
		yield* free;
		const answered = yield* host.applied();
		expect(answered.responses?.filter((receipt) => receipt.decisionId === decision.id)).toHaveLength(1);
		expect(answered.blocker).not.toBe(ANSWER_RECORDED);
		expect(renderStatus(yield* host.status())).not.toContain(ANSWER_RECORDED);
	});

	answers.it(
		`a disconnected ${release ? "release" : "text"} answer still records and applies when recording becomes available`,
		[],
		function* (host) {
			yield* host.dispatch();
			const { decision } = yield* host.question();
			const completion = yield* host.pauseCompletion();
			const abandoned = yield* host.answer(TEXT, release).pipe(Effect.flip);
			expect(abandoned.message).toContain("timed out");
			expect(abandoned.message).toContain("answer recording is unconfirmed");
			yield* completion.blocked;
			yield* completion.release;
			const applied = yield* host.applied();
			expect(applied.responses?.filter((receipt) => receipt.decisionId === decision.id)).toHaveLength(1);
		},
	);
}

answers.it("daemon answers share one watched Board response index", [answerWork(["one", "two"])], function* (host) {
	for (const workId of ["one", "two"]) {
		yield* host.dispatch(workId);
		const { decision } = yield* host.question(workId);
		const answered = yield* host.answerAndWait(workId === "one" ? TEXT : "", workId === "two", workId);
		expect(answered.responses?.filter((receipt) => receipt.decisionId === decision.id)).toHaveLength(1);
	}
	expect(host.responseIndexBuilds()).toBe(1);
});
