import { expect } from "@effect/vitest";
import { Effect, Scope } from "effect";
import { ANSWER_RECORDED } from "#attention.ts";
import { daemonClient, daemonRequest } from "#host/daemonClient.ts";
import { answerStore } from "#storage/answerStore.ts";
import { busyAdmission } from "#test/busyAdmission.ts";
import { dispatchAndWait, waitForRecord } from "#test/daemonActions.ts";
import type { HostFixture } from "#test/fleetHost.ts";
import { withReadDaemon } from "#test/readDaemon.ts";

const messages = ["Keep the loading indicator visible.", "Preserve the empty state."];

export const queuedAnswerRecovery = Effect.fn("AnswerQueueTest.queuedAnswerRecovery")(function* (fixture: HostFixture) {
	const scope = yield* Effect.scope;
	const current = yield* withReadDaemon(
		fixture.host,
		(port) => daemonClient(port).pipe(Effect.flatMap((client) => dispatchAndWait(client, "one"))),
		fixture.parts,
	);
	let free = Effect.succeed(false);
	yield* Effect.addFinalizer(() => free);
	yield* withReadDaemon(
		fixture.host,
		(port) =>
			Effect.gen(function* () {
				free = yield* busyAdmission(fixture.host).pipe(Effect.provideService(Scope.Scope, scope));
				for (const text of messages) {
					const recorded = yield* daemonRequest(port, (client) => client("daemon.answer", { text, workId: "one" }), "answer one", 500);
					expect(recorded.blocker).toBe(ANSWER_RECORDED);
				}
				const stored = yield* (yield* answerStore(fixture.host.namespace)).list("one");
				expect(stored.map((request) => request.text)).toEqual(messages);
			}),
		fixture.parts,
	);
	yield* free;
	yield* withReadDaemon(
		fixture.host,
		(port) =>
			Effect.gen(function* () {
				const client = yield* daemonClient(port);
				const queued = yield* waitForRecord(client, "one", (record) => record.pendingAnswers?.length === messages.length);
				expect(queued.pendingAnswers).toEqual(messages);
				expect(queued.attempts).toEqual(current.attempts);
				while ((yield* (yield* answerStore(fixture.host.namespace)).list("one")).length > 0) {
					yield* Effect.sleep("10 millis");
				}
				expect((yield* client("fleet.get", { workId: "one" })).pendingAnswers).toEqual(messages);
			}).pipe(Effect.timeout("10 seconds")),
		fixture.parts,
	);
});
