import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { daemonClient, daemonRequest } from "#host/daemonClient.ts";
import { answerDelay } from "#test/answerDelay.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { dispatchAndWait, waitForRecord } from "#test/daemonActions.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";
import { askWorker } from "#test/workerQuestion.ts";

type Delay = Effect.Success<ReturnType<typeof answerDelay>>;
const test = postgresTests("live");

const steerRequest = Effect.fn("AnswerTimeoutTest.steerRequest")(function* (
	fixture: HostFixture,
	port: number,
	delay: Delay,
	command: "answer" | "dispatch",
	fail: boolean,
) {
	yield* Effect.addFinalizer(() => delay.release);
	const client = yield* daemonClient(port);
	const started = yield* dispatchAndWait(client, "one");
	const current = task("one", "approved", "Revised criteria.");
	fixture.write("one.md", current.replace("kind: task", "kind: task\nowner: human"));
	const stopped = yield* client("fleet.reconcile", { workId: "one" });
	expect(stopped.decision?.code).toBe("fleet-stale");
	fixture.write("one.md", current);
	delay.enable();
	const accepted = yield* daemonRequest(
		port,
		(peer) => (command === "answer" ? peer("daemon.answer", { workId: "one" }) : peer("daemon.dispatch", { workId: "one" })),
		`${command} one`,
		1500,
	);
	expect(accepted.workId).toBe("one");
	if (command === "answer") {
		expect(accepted.blocker).toBe("Answer recorded; applying in the background");
		expect(boardHttpFiles(fixture.host.boardDir).read(`responses/response.fleet-retry.${stopped.decision?.published?.questionId}.md`)).toContain(
			"author: orchestrator",
		);
	}
	yield* delay.entered;
	const pending = yield* client("fleet.get", { workId: "one" });
	expect(pending.boardContext).toBe(current);
	expect(pending.attempts[0]?.receipt).toEqual(started.attempts[0]?.receipt);
	expect(pending.attempts[0]?.briefSteers).toEqual([expect.objectContaining({ requestedAt: expect.any(Number) })]);
	yield* delay.release;
	const finished = yield* waitForRecord(client, "one", (record) => {
		const evidence = record.attempts[0]?.briefSteers?.[0];
		return evidence?.steeredAt !== undefined || evidence?.error !== undefined;
	});
	expect(finished.attempts[0]?.briefSteers?.[0]).toMatchObject(fail ? { error: "Delayed provider failure" } : { steeredAt: expect.any(Number) });
});

const steerStory = Effect.fn("AnswerTimeoutTest.steerStory")(function* (fixture: HostFixture, command: "answer" | "dispatch", fail: boolean) {
	const delay = yield* answerDelay(fixture, "steer", fail);
	return yield* withReadDaemon(fixture.host, (port) => steerRequest(fixture, port, delay, command, fail), delay.parts);
});

const cliRequest = Effect.fn("AnswerTimeoutTest.cliRequest")(function* (
	fixture: HostFixture,
	port: number,
	delay: Delay,
	command: "answer" | "release" | "dispatch",
) {
	yield* Effect.addFinalizer(() => delay.release);
	const client = yield* daemonClient(port);
	if (command !== "dispatch") {
		yield* dispatchAndWait(client, "one");
		yield* askWorker(fixture.provider);
		yield* client("fleet.reconcile", { workId: "one" });
	}
	delay.enable();
	const args = command === "dispatch" ? ["dispatch", "one"] : ["answer", "one", ...(command === "release" ? ["--release"] : ["Use PostgreSQL."])];
	const result = yield* Effect.promise(() => cliProcess([...args, "--port", String(port)])).pipe(Effect.timeout("3 seconds"));
	expect(result.code).toBe(0);
	expect(result.stdout).toContain("recorded");
	yield* delay.entered;
	yield* delay.release;
	yield* waitForRecord(client, "one", (record) =>
		command === "release" ? record.attempts[0]?.sessionCleanupComplete === true : record.attempts.at(-1)?.receipt !== undefined,
	);
});

const cliStory = Effect.fn("AnswerTimeoutTest.cliStory")(function* (fixture: HostFixture, command: "answer" | "release" | "dispatch") {
	const delay = yield* answerDelay(fixture, command === "release" ? "archive" : "startTurn");
	return yield* withReadDaemon(fixture.host, (port) => cliRequest(fixture, port, delay, command), delay.parts);
});

for (const command of ["answer", "dispatch"] as const) {
	for (const fail of [false, true]) {
		test(`${command} acknowledges a durable record while provider steering is blocked, failure=${fail}`, () =>
			withHost({ "one.md": task("one", "approved") }, {}, (fixture) => steerStory(fixture, command, fail)));
	}
}

for (const command of ["answer", "release", "dispatch"] as const) {
	test(`the ${command} CLI exits while its provider work remains blocked`, () =>
		withHost({ "one.md": task("one", "approved") }, {}, (fixture) => cliStory(fixture, command)));
}
