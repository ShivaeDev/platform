import { expect } from "@effect/vitest";
import { answers } from "#test/answerHost.ts";

for (const release of [false, true]) {
	answers.it(`the ${release ? "release" : "text"} answer CLI reports failure when its request cannot be recorded`, [], function* (host) {
		yield* host.dispatch();
		const { decision } = yield* host.question();
		yield* host.failRecording(true);
		const result = yield* host.cliAnswer("one", "Use PostgreSQL.", release);
		expect(result.code).toBe(1);
		expect(result.stdout).not.toContain("recorded");
		expect(result.stderr).toContain("failed");
		expect((yield* host.get()).decision).toEqual(decision);
		expect(host.boardReceipts()).toHaveLength(0);
		yield* host.failRecording(false);
		const applied = yield* host.answerAndWait("Use PostgreSQL.", release);
		expect(applied.responses?.at(-1)).toMatchObject({ decisionId: decision.id });
	});
}
