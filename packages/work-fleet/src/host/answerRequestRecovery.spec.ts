import { expect } from "@effect/vitest";
import { Effect, Scope } from "effect";
import { ANSWER_RECORDED } from "#attention.ts";
import { daemonClient, daemonRequest } from "#host/daemonClient.ts";
import { answerStore } from "#storage/answerStore.ts";
import { busyAdmission } from "#test/busyAdmission.ts";
import { appliedAnswer, dispatchAndWait } from "#test/daemonActions.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";
import { askWorker } from "#test/workerQuestion.ts";

const recoveryStory = Effect.fn("AnswerRequestRecoveryTest.recoveryStory")(function* (fixture: HostFixture, release: boolean) {
	const scope = yield* Effect.scope;
	const decision = yield* withReadDaemon(
		fixture.host,
		(port) =>
			Effect.gen(function* () {
				const client = yield* daemonClient(port);
				yield* dispatchAndWait(client, "one");
				return (yield* askWorker(fixture.provider)).decision;
			}),
		{ parts: fixture.parts },
	);
	let free = Effect.succeed(false);
	yield* Effect.addFinalizer(() => free);
	yield* withReadDaemon(
		fixture.host,
		(port) =>
			Effect.gen(function* () {
				free = yield* busyAdmission(fixture.host).pipe(Effect.provideService(Scope.Scope, scope));
				const receipt = yield* daemonRequest(
					port,
					(client) => client("daemon.answer", { release, text: "Use PostgreSQL.", workId: "one" }),
					"answer one",
					500,
				);
				expect(receipt.blocker).toBe(ANSWER_RECORDED);
				const stored = yield* (yield* answerStore(fixture.host.namespace)).list("one");
				expect(stored).toMatchObject([{ "decision_id": decision.id, release, text: "Use PostgreSQL." }]);
			}),
		{ parts: fixture.parts },
	);
	yield* free;
	yield* withReadDaemon(
		fixture.host,
		(port) =>
			Effect.gen(function* () {
				const client = yield* daemonClient(port);
				const applied = yield* appliedAnswer(client, "one");
				expect(applied.stage).toBe(release ? "released" : "executing");
				expect(applied.responses?.filter((receipt) => receipt.decisionId === decision.id)).toHaveLength(1);
				if (!release) {
					expect(applied.attempts.at(-1)?.prompt).toBe("Use PostgreSQL.");
				}
				expect(yield* (yield* answerStore(fixture.host.namespace)).list("one")).toEqual([]);
			}),
		{ parts: fixture.parts },
	);
});

for (const release of [false, true]) {
	postgresTests("live")(`a recorded ${release ? "release" : "text"} request survives daemon shutdown before admission frees`, () =>
		withHost({ "one.md": task("one", "approved") }, {}, (fixture) => recoveryStory(fixture, release)),
	);
}
