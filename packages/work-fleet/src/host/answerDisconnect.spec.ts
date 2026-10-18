import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { ANSWER_RECORDED } from "#attention.ts";
import { daemonClient, daemonRequest } from "#host/daemonClient.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { busyAdmission, busyAnswerRecording } from "#test/busyAdmission.ts";
import { dispatchAndWait, waitForRecord } from "#test/daemonActions.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";
import { spanCounts } from "#test/spanCounts.ts";
import { askWorker } from "#test/workerQuestion.ts";

const test = postgresTests("live");

const recordedAnswer = Effect.fn("AnswerDisconnectTest.recordedAnswer")(function* (fixture: HostFixture, port: number, release: boolean) {
	const client = yield* daemonClient(port);
	yield* dispatchAndWait(client, "one");
	const { decision } = yield* askWorker(fixture.provider);
	const free = yield* busyAdmission(fixture.host);
	yield* Effect.addFinalizer(() => free);
	const recorded = yield* daemonRequest(
		port,
		(peer) => peer("daemon.answer", { release, text: release ? "" : "Use PostgreSQL.", workId: "one" }),
		"answer one",
		500,
	);
	expect(recorded.blocker).toBe(ANSWER_RECORDED);
	const args = ["answer", "one", ...(release ? ["--release"] : ["Use PostgreSQL."]), "--port", String(port)];
	let stderr = "";
	const result = yield* Effect.promise(() =>
		cliProcess(args, {
			onError: (text) => {
				stderr += text;
			},
		}),
	).pipe(Effect.timeout("5 seconds"));
	expect(result).toEqual({ code: 0, stdout: `one needs-human: ${ANSWER_RECORDED}` });
	expect(stderr).not.toContain("unconfirmed");
	const competing = yield* daemonRequest(
		port,
		(peer) => peer("daemon.answer", { release: !release, text: "Use PostgreSQL.", workId: "one" }),
		"answer one",
		500,
	).pipe(Effect.flip);
	expect(competing._tag).toBe("Conflict");
	const pending = yield* daemonRequest(port, (peer) => peer("daemon.status", {}), "status", 500);
	expect(pending.waiting.automation).toMatchObject([{ blocker: ANSWER_RECORDED, workId: "one" }]);
	expect(renderStatus(pending)).toContain(ANSWER_RECORDED);
	yield* free;
	const answered = yield* waitForRecord(client, "one", (record) => record.decision?.id !== decision.id);
	expect(answered.responses?.at(-1)).toMatchObject({ decisionId: decision.id });
	expect(answered.blocker).not.toBe(ANSWER_RECORDED);
	expect(answered.responses?.filter((receipt) => receipt.decisionId === decision.id)).toHaveLength(1);
	const status = yield* client("daemon.status", {});
	expect(renderStatus(status)).not.toContain(ANSWER_RECORDED);
});

for (const release of [false, true]) {
	test(`a ${release ? "release" : "text"} answer confirms within the acknowledgement timeout and applies once admission frees`, () =>
		withHost({ "one.md": task("one", "approved") }, {}, (fixture) =>
			withReadDaemon(fixture.host, (port) => recordedAnswer(fixture, port, release), { parts: fixture.parts }),
		));
	test(`a disconnected ${release ? "release" : "text"} answer still records and applies when recording becomes available`, () =>
		withHost({ "one.md": task("one", "approved") }, {}, (fixture) =>
			withReadDaemon(fixture.host, (port) => disconnectedAnswer(fixture, port, release), { parts: fixture.parts }),
		));
}

const disconnectedAnswer = Effect.fn("AnswerDisconnectTest.disconnectedAnswer")(function* (fixture: HostFixture, port: number, release: boolean) {
	const client = yield* daemonClient(port);
	yield* dispatchAndWait(client, "one");
	const { decision } = yield* askWorker(fixture.provider);
	const free = yield* busyAnswerRecording(fixture.host, "one");
	yield* Effect.addFinalizer(() => free);
	const abandoned = yield* daemonRequest(
		port,
		(peer) => peer("daemon.answer", { release, text: "Use PostgreSQL.", workId: "one" }),
		"answer one",
		500,
	).pipe(Effect.flip);
	expect(abandoned.message).toContain("timed out");
	expect(abandoned.message).toContain("answer recording is unconfirmed");
	yield* free;
	const applied = yield* waitForRecord(client, "one", (record) => record.decision?.id !== decision.id);
	expect(applied.responses?.filter((receipt) => receipt.decisionId === decision.id)).toHaveLength(1);
});

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
