import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { daemonClient } from "#host/daemonClient.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { answerAndWait, dispatchAndWait } from "#test/daemonActions.ts";
import { finishWorkers } from "#test/engine.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";
import { askWorker } from "#test/workerQuestion.ts";

const test = postgresTests("live");

for (const worker of [false, true]) {
	for (const release of [false, true]) {
		test(`oversized text leaves no response and permits a later valid answer with worker=${worker}, release=${release}`, () =>
			withHost({ "one.md": task("one", "approved") }, {}, (fixture) =>
				withReadDaemon(fixture.host, (port) => answerValidationStory(fixture, port, worker, release), { parts: fixture.parts }),
			));
	}
}

const answerValidationStory = Effect.fn("AnswerValidationTest.answerValidationStory")(function* (
	fixture: HostFixture,
	port: number,
	worker: boolean,
	release: boolean,
) {
	const client = yield* daemonClient(port);
	const started = yield* dispatchAndWait(client, "one");
	if (worker) {
		yield* askWorker(fixture.provider);
	} else {
		finishWorkers(fixture.provider);
	}
	const waiting = yield* client("fleet.reconcile", { workId: "one" });
	const error = yield* answerAndWait(client, { release, text: "x".repeat(32_769), workId: "one" }).pipe(Effect.flip);
	const files = boardHttpFiles(fixture.host.boardDir);
	expect(readdirSync(join(fixture.host.boardDir, "responses")).filter((file) => file.startsWith("response."))).toEqual([]);
	expect(files.receipts()).toEqual([]);
	expect(error).toMatchObject({ _tag: "BadRequest", message: expect.stringContaining("32768") });
	const rejected = yield* client("fleet.get", { workId: "one" });
	expect(rejected.decision).toEqual(waiting.decision);
	expect(rejected.responses).toEqual(waiting.responses);
	const text = "v".repeat(32_768);
	const answered = yield* answerAndWait(client, { release, text, workId: "one" });
	const stage = worker ? "executing" : "adopting";
	expect(answered.stage).toBe(release ? "released" : stage);
	expect(answered.responses?.at(-1)).toMatchObject({ boardAcknowledged: true });
	expect(files.receipts()).toHaveLength(1);
	if (worker && !release) {
		expect(answered.attempts.at(-1)?.prompt).toBe(text);
		expect(answered.attempts.at(-1)?.receipt?.sessionId).toBe(started.attempts[0]?.receipt?.sessionId);
	}
});
