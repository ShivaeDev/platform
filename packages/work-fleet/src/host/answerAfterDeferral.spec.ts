import { expect } from "@effect/vitest";
import { ANSWER_RECORDED } from "#attention.ts";
import { answers } from "#test/answerHost.ts";

const TEXT = "Use PostgreSQL and retain the transaction boundary.";

for (const type of ["clarify", "not_now"] as const) {
	for (const release of [false, true]) {
		answers.it(`a CLI ${release ? "release" : "text"} answer applies after a reconciled ${type} response`, [], function* (host) {
			yield* host.dispatch();
			const { decision } = yield* host.question();
			const deferred = yield* host.defer(decision, type);
			const waiting = yield* host.reconcile();
			expect(waiting.step).toBe("waiting");
			expect(waiting.decision?.id).toBe(decision.id);
			expect(waiting.responses).toMatchObject([{ decisionId: decision.id, responseId: deferred.id, type }]);
			expect(yield* host.cliAnswer("one", TEXT, release)).toEqual({
				code: 0,
				stderr: "",
				stdout: `one waiting (waiting on automation): ${ANSWER_RECORDED}`,
			});
			const applied = yield* host.applied();
			expect(applied.step).toBe(release ? "released" : "working");
			expect(applied.responses).toMatchObject([
				{ decisionId: decision.id, responseId: deferred.id, type },
				{ action: release ? "release" : "continue", boardAcknowledged: true, decisionId: decision.id, type: "answer" },
			]);
			expect(applied.responses?.at(-1)?.responseId).not.toBe(deferred.id);
			expect(host.providerLaunches()).toEqual([applied.attempts[0]?.operationId]);
			expect(host.providerReceipts()).toEqual(applied.attempts.map((attempt) => attempt.receipt));
			if (!release) {
				expect(applied.attempts.at(-1)?.prompt).toBe(TEXT);
			}
		});
	}
}
