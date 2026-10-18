import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { daemonClient } from "#host/daemonClient.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { appliedAnswer, dispatchAndWait } from "#test/daemonActions.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";

const test = postgresTests("live");

for (const source of ["argument", "stdin", "release"] as const) {
	test(
		`answer from ${source} records a worker response and an applied receipt`,
		() =>
			withHost({ "one.md": task("one", "approved") }, {}, (fixture) =>
				withReadDaemon(fixture.host, (port) => workerQuestionStory(fixture, port, source), { parts: fixture.parts }),
			),
		30_000,
	);
}

const workerQuestionStory = Effect.fn("DaemonCommandsTest.workerQuestionStory")(function* (
	fixture: HostFixture,
	port: number,
	source: "argument" | "stdin" | "release",
) {
	const client = yield* daemonClient(port);
	const started = yield* dispatchAndWait(client, "one");
	const turnId = started.attempts.at(-1)?.receipt?.turnId ?? "missing";
	const observation = fixture.provider.observations.get(turnId);
	if (observation === undefined) {
		return yield* Effect.die("Expected a worker observation");
	}
	fixture.provider.observations.set(turnId, { ...observation, execution: "completed", output: "FLEET_QUESTION: Which storage should I use?" });
	const waiting = yield* client("fleet.reconcile", { workId: "one" });
	expect(waiting.decision?.worker).toBeDefined();
	if (source === "argument") {
		const status = (yield* Effect.promise(() => cliProcess(["status", "--port", String(port)]))).stdout;
		expect(status).toContain("Which storage should I use?");
		expect(status.split("\n")).toContain(`    work-fleet answer one --port ${port}`);
	}
	expect(renderStatus(yield* client("daemon.status", {}))).toContain("work-fleet answer one");
	expect(yield* client("daemon.answer", { text: "  ", workId: "one" }).pipe(Effect.flip)).toMatchObject({ _tag: "BadRequest" });
	const answer = "Use PostgreSQL and preserve the existing repository API.";
	const argumentsBySource = { argument: [answer], release: ["--release"], stdin: [] };
	const result = yield* Effect.promise(() =>
		cliProcess(["answer", "one", ...argumentsBySource[source], "--port", String(port)], {
			stdin: source === "stdin" ? answer : "",
		}),
	);
	expect(result).toEqual({ code: 0, stdout: "one needs-human: Answer recorded; applying in the background" });
	const queued = yield* appliedAnswer(client, "one");
	expect(queued.responses).toMatchObject([{ action: source === "release" ? "release" : "continue", boardAcknowledged: true }]);
	const published = waiting.decision?.published;
	if (published === undefined) {
		return yield* Effect.die("Expected a worker question");
	}
	const files = boardHttpFiles(fixture.host.boardDir);
	const response = files.read(`responses/response.fleet-${source === "release" ? "release" : "retry"}.${published.questionId}.md`);
	if (source !== "release") {
		expect(response).toContain(answer);
	}
	expect(response).toContain("author: orchestrator");
	if (source !== "release") {
		expect(response).not.toContain("fleet-action");
	}
	expect(files.receipts()).toHaveLength(1);
	expect(files.read(files.receipts()[0] ?? "missing")).toContain('"disposition":"applied"');
	if (source === "release") {
		expect(queued.stage).toBe("released");
		expect(fixture.provider.launched).toHaveLength(1);
		return;
	}
	const resumed = yield* client("fleet.reconcile", { workId: "one" });
	expect(resumed.stage).toBe("executing");
	expect(resumed.attempts.at(-1)?.receipt?.sessionId).toBe(started.attempts[0]?.receipt?.sessionId);
	expect(resumed.attempts.at(-1)?.prompt).toBe(answer);
	expect(fixture.provider.launched).toHaveLength(1);
});
