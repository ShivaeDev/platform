import { expect } from "@effect/vitest";
import { ANSWER_RECORDED } from "#attention.ts";
import { answers } from "#test/answerHost.ts";

for (const release of [false, true]) {
	answers.it(`a recorded ${release ? "release" : "text"} request survives daemon shutdown before admission frees`, [], function* (host) {
		yield* host.dispatch();
		const { decision } = yield* host.question();
		yield* host.stop();
		yield* host.start();
		const free = yield* host.holdAdmission();
		const receipt = yield* host.answer("Use PostgreSQL.", release);
		expect(receipt.blocker).toBe(ANSWER_RECORDED);
		expect(yield* host.storedRequests()).toMatchObject([{ "decision_id": decision.id, release, text: "Use PostgreSQL." }]);
		yield* host.stop();
		yield* free;
		yield* host.start();
		const applied = yield* host.applied();
		expect(applied.stage).toBe(release ? "released" : "executing");
		expect(applied.responses?.filter((response) => response.decisionId === decision.id)).toHaveLength(1);
		if (!release) {
			expect(applied.attempts.at(-1)?.prompt).toBe("Use PostgreSQL.");
		}
		expect(yield* host.storedRequests()).toEqual([]);
	});
}
