import { expect } from "@effect/vitest";
import { answers } from "#test/answerHost.ts";

const TEXT = "Use PostgreSQL.";

for (const release of [false, true]) {
	for (const applied of [false, true]) {
		answers.it(`a ${release ? "release" : "text"} request restarts ${applied ? "after" : "before"} its exact response applies`, [], function* (host) {
			yield* host.dispatch();
			const { decision } = yield* host.question();
			yield* host.defer(decision, "clarify");
			yield* host.reconcile();
			const request = yield* host.seedRecordedRequest(decision, TEXT, release);
			const responseId = yield* host.publishResponse(decision, TEXT, release);
			yield* host.seedResponseIdentity(request, { decisionId: decision.id, responseId });
			if (applied) {
				yield* host.resolve(decision.id, responseId);
			}
			expect(yield* host.storedRequests()).toMatchObject([{ "response_decision_id": decision.id, "response_id": responseId }]);
			const previous = yield* host.get();
			yield* host.stop();
			yield* host.start();
			const current = yield* host.applied();
			expect(current.stage).toBe(release ? "released" : "executing");
			expect(current.responses).toHaveLength(2);
			expect(current.pendingAnswers).toBeUndefined();
			expect(host.provider.launched).toHaveLength(1);
			expect(host.provider.observations.size).toBe(release ? 1 : 2);
			if (applied) {
				expect(current.attempts).toEqual(previous.attempts);
				expect(current.responses).toEqual(previous.responses);
			}
			expect(yield* host.storedRequests()).toEqual([]);
		});
	}
}
