import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { daemonClient } from "#host/daemonClient.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { daemonResources } from "#test/daemonResources.ts";
import { finishWorkers } from "#test/engine.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";

const test = postgresTests("live");

const decisionStory = Effect.fn("DaemonCommandsTest.decisionStory")(function* (
	fixture: HostFixture,
	port: number,
	action: "retry" | "release",
	resources: Effect.Success<ReturnType<typeof daemonResources>>,
) {
	const client = yield* daemonClient(port);
	yield* client("daemon.dispatch", { workId: "one" });
	finishWorkers(fixture.provider);
	const waiting = yield* client("fleet.reconcile", { workId: "one" });
	expect(waiting.stage).toBe("needs-human");
	const published = waiting.decision?.published;
	if (published === undefined) {
		return yield* Effect.die("Expected a published decision");
	}
	const args = ["decide", "one", action, "--port", String(port), "--config", "unused.json"];
	expect(yield* Effect.promise(() => cliProcess(args))).toEqual({
		code: 0,
		stdout: `one ${action === "retry" ? "adopting" : "released"}`,
	});
	const current = yield* client("fleet.get", { workId: "one" });
	expect(current.decision).toBeUndefined();
	expect(current.responses).toMatchObject([{ action, boardAcknowledged: true, decisionId: waiting.decision?.id, questionId: published.questionId }]);
	const files = boardHttpFiles(fixture.host.boardDir);
	expect(files.read(`responses/response.fleet-${action}.${published.questionId}.md`)).toContain(`Selected: ${action}`);
	expect(files.receipts()).toHaveLength(1);
	expect((yield* Effect.promise(() => cliProcess(args))).code).toBe(1);
	expect(files.receipts()).toHaveLength(1);
	expect(resources.providers).toBe(1);
	expect(resources.releases).toBe(0);
	expect(fixture.provider.launched).toHaveLength(1);
});

for (const action of ["retry", "release"] as const) {
	test(
		`decide ${action} answers the published decision by item through the daemon without a client database connection`,
		() => withHost({ "one.md": task("one", "approved") }, {}, (fixture) => decisionResources(fixture, action)),
		30_000,
	);
}

const decisionResources = Effect.fn("DaemonCommandsTest.decisionResources")(function* (fixture: HostFixture, action: "retry" | "release") {
	const resources = yield* daemonResources(fixture.parts.provider);
	yield* withReadDaemon(fixture.host, (port) => decisionStory(fixture, port, action, resources), { ...fixture.parts, provider: resources.provider });
	expect(resources.releases).toBe(1);
});

test(
	"decide rejects an active item without recording a response",
	() =>
		withHost({ "one.md": task("one", "approved") }, {}, (fixture) =>
			withReadDaemon(fixture.host, (port) => activeStory(fixture, port), fixture.parts),
		),
	30_000,
);

const activeStory = Effect.fn("DaemonCommandsTest.activeStory")(function* (fixture: HostFixture, port: number) {
	const client = yield* daemonClient(port);
	yield* client("daemon.dispatch", { workId: "one" });
	let stderr = "";
	function captureError(text: string) {
		stderr += text;
	}
	const result = yield* Effect.promise(() =>
		cliProcess(["decide", "one", "release", "--port", String(port)], {
			onError: captureError,
		}),
	);
	expect(result.code).toBe(1);
	expect(stderr).toContain("Answer an open published Fleet decision");
	expect((yield* client("fleet.get", { workId: "one" })).stage).toBe("executing");
	expect(existsSync(join(fixture.host.boardDir, "responses"))).toBe(false);
});

test(
	"decide retry requires a worker answer and preserves the open question",
	() =>
		withHost({ "one.md": task("one", "approved") }, {}, (fixture) =>
			withReadDaemon(fixture.host, (port) => workerQuestionStory(fixture, port), fixture.parts),
		),
	30_000,
);

const workerQuestionStory = Effect.fn("DaemonCommandsTest.workerQuestionStory")(function* (fixture: HostFixture, port: number) {
	const client = yield* daemonClient(port);
	const started = yield* client("daemon.dispatch", { workId: "one" });
	const turnId = started.attempts.at(-1)?.receipt?.turnId ?? "missing";
	const observation = fixture.provider.observations.get(turnId);
	if (observation === undefined) {
		return yield* Effect.die("Expected a worker observation");
	}
	fixture.provider.observations.set(turnId, { ...observation, execution: "completed", output: "FLEET_QUESTION: Which storage should I use?" });
	const waiting = yield* client("fleet.reconcile", { workId: "one" });
	expect(waiting.decision?.worker).toBeDefined();
	let stderr = "";
	const result = yield* Effect.promise(() =>
		cliProcess(["decide", "one", "retry", "--port", String(port)], {
			onError: (text) => {
				stderr += text;
			},
		}),
	);
	expect(result.code).toBe(1);
	expect(stderr).toContain("Answer the worker question or use continue with a message");
	expect((yield* client("fleet.get", { workId: "one" })).decision).toEqual(waiting.decision);
	expect(readdirSync(join(fixture.host.boardDir, "responses")).filter((file) => file.startsWith("response."))).toEqual([]);
	expect(fixture.provider.launched).toHaveLength(1);
});
