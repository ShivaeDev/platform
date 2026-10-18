import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { daemonClient } from "#host/daemonClient.ts";
import { answerRecordingFailure } from "#test/answerRecordingFailure.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { answerAndWait, dispatchAndWait } from "#test/daemonActions.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";
import { askWorker } from "#test/workerQuestion.ts";

const recordingFailure = Effect.fn("AnswerRecordingTest.recordingFailure")(function* (fixture: HostFixture, port: number, release: boolean) {
	const client = yield* daemonClient(port);
	yield* dispatchAndWait(client, "one");
	const { decision } = yield* askWorker(fixture.provider);
	yield* answerRecordingFailure(fixture.host, true);
	let stderr = "";
	const args = ["answer", "one", ...(release ? ["--release"] : ["Use PostgreSQL."]), "--port", String(port)];
	const result = yield* Effect.promise(() =>
		cliProcess(args, {
			onError: (text) => {
				stderr += text;
			},
		}),
	);
	expect(result.code).toBe(1);
	expect(result.stdout).not.toContain("recorded");
	expect(stderr).toContain("failed");
	expect((yield* client("fleet.get", { workId: "one" })).decision).toEqual(decision);
	expect(boardHttpFiles(fixture.host.boardDir).receipts()).toHaveLength(0);
	yield* answerRecordingFailure(fixture.host, false);
	const applied = yield* answerAndWait(client, { release, text: "Use PostgreSQL.", workId: "one" });
	expect(applied.responses?.at(-1)).toMatchObject({ decisionId: decision.id });
});

for (const release of [false, true]) {
	postgresTests("live")(`the ${release ? "release" : "text"} answer CLI reports failure when its request cannot be recorded`, () =>
		withHost({ "one.md": task("one", "approved") }, {}, (fixture) =>
			withReadDaemon(fixture.host, (port) => recordingFailure(fixture, port, release), { parts: fixture.parts }),
		),
	);
}
