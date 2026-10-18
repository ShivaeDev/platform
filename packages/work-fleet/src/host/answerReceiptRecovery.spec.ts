import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { daemonClient } from "#host/daemonClient.ts";
import { recordDecisionResponse } from "#host/recordDecisionResponse.ts";
import { withDecisionResponses } from "#host/releaseWork.ts";
import { answerStore } from "#storage/answerStore.ts";
import { appliedAnswer, dispatchAndWait } from "#test/daemonActions.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";
import { answerWorker, askWorker } from "#test/workerQuestion.ts";

const TEXT = "Use PostgreSQL.";

const recoverReceipt = Effect.fn("AnswerSpec.recoverReceipt")(function* (fixture: HostFixture, release: boolean, applied: boolean) {
	const previous = yield* withReadDaemon(
		fixture.host,
		(port) =>
			Effect.gen(function* () {
				const client = yield* daemonClient(port);
				yield* dispatchAndWait(client, "one");
				const { decision, published } = yield* askWorker(fixture.provider);
				yield* answerWorker(fixture.host.boardDir, decision, "response.worker.clarify", "clarify");
				yield* client("fleet.reconcile", { workId: "one" });
				const store = yield* answerStore(fixture.host.namespace);
				const request = yield* store.accept("one", decision, TEXT, release);
				const responseId = yield* withDecisionResponses(
					fixture.host,
					recordDecisionResponse(fixture.host.boardDir, { ...decision, published }, release ? "release" : "retry", TEXT),
				);
				yield* store.recordResponse(request, { decisionId: decision.id, responseId });
				if (applied) {
					yield* client("fleet.resolve", { decisionId: decision.id, responseId, workId: "one" });
				}
				expect(yield* store.list("one")).toMatchObject([{ "response_decision_id": decision.id, "response_id": responseId }]);
				return yield* client("fleet.get", { workId: "one" });
			}),
		{ parts: fixture.parts },
	);
	yield* withReadDaemon(
		fixture.host,
		(port) =>
			Effect.gen(function* () {
				const client = yield* daemonClient(port);
				const current = yield* appliedAnswer(client, "one");
				expect(current.stage).toBe(release ? "released" : "executing");
				expect(current.responses).toHaveLength(2);
				expect(current.pendingAnswers).toBeUndefined();
				expect(fixture.provider.launched).toHaveLength(1);
				expect(fixture.provider.observations.size).toBe(release ? 1 : 2);
				if (applied) {
					expect(current.attempts).toEqual(previous.attempts);
					expect(current.responses).toEqual(previous.responses);
				}
				expect(yield* (yield* answerStore(fixture.host.namespace)).list("one")).toEqual([]);
			}),
		{ parts: fixture.parts },
	);
});

for (const release of [false, true]) {
	for (const applied of [false, true]) {
		postgresTests("live")(`a ${release ? "release" : "text"} request restarts ${applied ? "after" : "before"} its exact response applies`, () =>
			withHost({ "one.md": task("one", "approved") }, {}, (fixture) => recoverReceipt(fixture, release, applied)),
		);
	}
}
