import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { board as boardApi } from "@shivaedev/work-board/integration/board.ts";
import { daemonClient } from "#host/daemonClient.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { appliedAnswer, dispatchAndWait } from "#test/daemonActions.ts";
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
	yield* dispatchAndWait(client, "one");
	finishWorkers(fixture.provider);
	const waiting = yield* client("fleet.reconcile", { workId: "one" });
	expect(waiting.stage).toBe("needs-human");
	const published = waiting.decision?.published;
	if (published === undefined) {
		return yield* Effect.die("Expected a published decision");
	}
	const args = ["answer", "one", ...(action === "release" ? ["--release"] : []), "--port", String(port), "--config", "unused.json"];
	expect(yield* Effect.promise(() => cliProcess(args))).toEqual({
		code: 0,
		stdout: "one needs-human: Answer recorded; applying in the background",
	});
	const current = yield* appliedAnswer(client, "one");
	expect(current.decision).toBeUndefined();
	expect(current.responses).toMatchObject([{ action, boardAcknowledged: true, decisionId: waiting.decision?.id, questionId: published.questionId }]);
	const files = boardHttpFiles(fixture.host.boardDir);
	expect(boardApi.metadataParse(files.read(`responses/response.fleet-${action}.${published.questionId}.md`)).fields.response?.answers).toEqual([
		{ prompt: "fleet-action", selected: [action], text: "" },
	]);
	expect(files.receipts()).toHaveLength(1);
	expect((yield* Effect.promise(() => cliProcess(args))).code).toBe(1);
	expect(files.receipts()).toHaveLength(1);
	expect(resources.providers).toBe(1);
	expect(resources.releases).toBe(0);
	expect(fixture.provider.launched).toHaveLength(1);
});

for (const action of ["retry", "release"] as const) {
	test(
		`answer ${action} answers the published decision by item through the daemon without a client database connection`,
		() => withHost({ "one.md": task("one", "approved") }, {}, (fixture) => decisionResources(fixture, action)),
		30_000,
	);
}

const decisionResources = Effect.fn("DaemonCommandsTest.decisionResources")(function* (fixture: HostFixture, action: "retry" | "release") {
	const resources = yield* daemonResources(fixture.parts.provider);
	yield* withReadDaemon(fixture.host, (port) => decisionStory(fixture, port, action, resources), {
		parts: { ...fixture.parts, provider: resources.provider },
	});
	expect(resources.releases).toBe(1);
});

test(
	"answer rejects an active item without recording a response",
	() =>
		withHost({ "one.md": task("one", "approved") }, {}, (fixture) =>
			withReadDaemon(fixture.host, (port) => activeStory(fixture, port), { parts: fixture.parts }),
		),
	30_000,
);

const activeStory = Effect.fn("DaemonCommandsTest.activeStory")(function* (fixture: HostFixture, port: number) {
	const client = yield* daemonClient(port);
	yield* dispatchAndWait(client, "one");
	let stderr = "";
	function captureError(text: string) {
		stderr += text;
	}
	const result = yield* Effect.promise(() =>
		cliProcess(["answer", "one", "--release", "--port", String(port)], {
			onError: captureError,
		}),
	);
	expect(result.code).toBe(1);
	expect(stderr).toContain("one waits on no answer in stage executing");
	expect(yield* client("daemon.answer", { workId: "one" }).pipe(Effect.flip)).toMatchObject({
		_tag: "BadRequest",
		message: expect.stringContaining("executing"),
	});
	expect((yield* client("fleet.get", { workId: "one" })).stage).toBe("executing");
	expect(existsSync(join(fixture.host.boardDir, "responses"))).toBe(false);
});
