import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { ANSWER_RECORDED, waitingOwner } from "#attention.ts";
import { daemonClient } from "#host/daemonClient.ts";
import { recordDecisionResponse } from "#host/recordDecisionResponse.ts";
import { withDecisionResponses } from "#host/releaseWork.ts";
import { dispatchAndWait } from "#test/daemonActions.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { withFollower } from "#test/follower.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";
import { storeState } from "#test/storeState.ts";
import { askWorker } from "#test/workerQuestion.ts";

const saveAnswer = Effect.fn("AnswerRecoveryTest.saveAnswer")(function* (fixture: HostFixture, port: number, release: boolean) {
	const client = yield* daemonClient(port);
	yield* dispatchAndWait(client, "one");
	const { decision, published, stopped } = yield* askWorker(fixture.provider);
	const id = yield* withDecisionResponses(
		fixture.host,
		recordDecisionResponse(fixture.host.boardDir, { ...decision, published }, release ? "release" : "retry", "Use PostgreSQL."),
	);
	yield* storeState(fixture.host, "one", { ...stopped.value, blocker: ANSWER_RECORDED });
	return id;
});

function watchAnswer(fixture: HostFixture, port: number, release: boolean, responseId: string, snapshot: Promise<void>) {
	return withFollower(fixture.configFile, "watch", [], { port }, (follower) =>
		Effect.gen(function* () {
			const client = yield* daemonClient(port);
			yield* Effect.promise(() => snapshot);
			yield* Effect.sleep("100 millis");
			expect(follower.isRunning()).toBe(true);
			expect(follower.output()).toBe("");
			expect(waitingOwner(yield* client("fleet.get", { workId: "one" }))).toBe("automation");
			const applied = yield* client("fleet.reconcile", { workId: "one" });
			expect(applied.responses).toMatchObject([{ boardAcknowledged: true, responseId }]);
			if (!release) {
				expect(applied.attempts.at(-1)?.prompt).toBe("Use PostgreSQL.");
				expect(applied.attempts).toHaveLength(2);
				yield* askWorker(fixture.provider);
			}
			const result = yield* Effect.promise(() => follower.done);
			expect(result.code).toBe(0);
			expect(result.stdout).toContain(release ? "one released" : "one needs-human");
			expect(fixture.provider.launched).toHaveLength(1);
		}),
	);
}

const recoveryStory = Effect.fn("AnswerRecoveryTest.recoveryStory")(function* (fixture: HostFixture, release: boolean) {
	const responseId = yield* withReadDaemon(fixture.host, (port) => saveAnswer(fixture, port, release), { parts: fixture.parts });
	const snapshot = Promise.withResolvers<void>();
	yield* withReadDaemon(fixture.host, (port) => watchAnswer(fixture, port, release, responseId, snapshot.promise), {
		onSnapshot: () => snapshot.resolve(),
		parts: fixture.parts,
	});
});

for (const release of [false, true]) {
	postgresTests("live")(`saved answers survive restart and watch waits for application: release=${release}`, () =>
		withHost({ "one.md": task("one", "approved") }, {}, (fixture) => recoveryStory(fixture, release)),
	);
}
