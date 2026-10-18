import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { ANSWER_RECORDED } from "#attention.ts";
import { daemonClient, daemonRequest } from "#host/daemonClient.ts";
import { busyAdmission } from "#test/busyAdmission.ts";
import { dispatchAndWait, waitForRecord } from "#test/daemonActions.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";
import { spanCounts } from "#test/spanCounts.ts";
import { askWorker } from "#test/workerQuestion.ts";

const test = postgresTests("live");

const abandonedAnswer = Effect.fn("AnswerDisconnectTest.abandonedAnswer")(function* (fixture: HostFixture, port: number, release: boolean) {
	const client = yield* daemonClient(port);
	yield* dispatchAndWait(client, "one");
	const { decision } = yield* askWorker(fixture.provider);
	const free = yield* busyAdmission(fixture.host);
	const abandoned = yield* daemonRequest(
		port,
		(peer) => peer("daemon.answer", { release, text: release ? "" : "Use PostgreSQL.", workId: "one" }),
		"answer one",
		500,
	).pipe(Effect.flip);
	expect(abandoned.message).toContain("timed out");
	yield* free;
	const answered = yield* waitForRecord(client, "one", (record) => record.decision?.id !== decision.id);
	expect(answered.responses?.at(-1)).toMatchObject({ decisionId: decision.id });
	expect(answered.blocker).not.toBe(ANSWER_RECORDED);
});

for (const release of [false, true]) {
	test(`a ${release ? "release" : "text"} answer the client stops waiting for still applies once admission frees`, () =>
		withHost({ "one.md": task("one", "approved") }, {}, (fixture) =>
			withReadDaemon(fixture.host, (port) => abandonedAnswer(fixture, port, release), { parts: fixture.parts }),
		));
}

const answerBoth = Effect.fn("AnswerDisconnectTest.answerBoth")(function* (fixture: HostFixture, port: number) {
	const client = yield* daemonClient(port);
	for (const workId of ["one", "two"]) {
		yield* dispatchAndWait(client, workId);
		const { decision } = yield* askWorker(fixture.provider, workId);
		yield* client("daemon.answer", { release: workId === "two", text: workId === "one" ? "Use PostgreSQL." : "", workId });
		yield* waitForRecord(client, workId, (record) => record.decision?.id !== decision.id);
	}
});

test("daemon answers share one watched Board response index", () =>
	withHost({ "one.md": task("one", "approved"), "two.md": task("two", "approved") }, {}, (fixture) =>
		Effect.gen(function* () {
			const spans = spanCounts();
			yield* spans.trace(withReadDaemon(fixture.host, (port) => answerBoth(fixture, port), { parts: fixture.parts }));
			expect(spans.count("WorkBoard.searchSnapshot")).toBe(1);
		}),
	));
