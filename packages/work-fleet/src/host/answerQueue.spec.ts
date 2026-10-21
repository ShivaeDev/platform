import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { ANSWER_RECORDED } from "#attention.ts";
import { daemonClient } from "#host/daemonClient.ts";
import type { FleetRecord } from "#model.ts";
import { type ApprovedPrFixture, type PrDaemonClient, repairAttempts, withApprovedPrDaemon } from "#test/approvedPrDaemon.ts";
import { answerAndWait, dispatchAndWait, waitForRecord } from "#test/daemonActions.ts";
import { finishWorkers } from "#test/engine.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";

const test = postgresTests("live");
const TEXT = "Keep the loading indicator visible.";

for (const step of ["repairing", "working"] as const) {
	test(`answer during ${step} survives daemon restart and reaches the next repair turn once`, () =>
		withApprovedPrDaemon((fixture) => queueStory(fixture, step)));
}

const queueStory = Effect.fn("AnswerQueueTest.queueStory")(function* (fixture: ApprovedPrFixture, step: "repairing" | "working") {
	const previous = yield* fixture.serve((client, port) => queueRepair(fixture, client, port, step));
	yield* fixture.serve((client) => deliverRepair(fixture, client, step, previous));
});

const queueRepair = Effect.fn("AnswerQueueTest.queueRepair")(function* (
	fixture: ApprovedPrFixture,
	client: PrDaemonClient,
	port: number,
	step: "repairing" | "working",
) {
	const ready = yield* fixture.ready(client);
	let current: FleetRecord;
	if (step === "working") {
		fixture.github.state.mergeable = "CONFLICTING";
		yield* client("fleet.reconcile", { workId: "one" });
		current = yield* fixture.started(client, "repair");
		fixture.github.state.mergeable = "MERGEABLE";
	} else {
		current = yield* client("fleet.resolve", fixture.answer(ready, "Preserve the empty state."));
	}
	expect(current.step).toBe(step);
	expect(yield* Effect.promise(() => cliProcess(["answer", "one", TEXT, "--port", String(port)]))).toEqual({
		code: 0,
		stdout: `one waiting (waiting on automation): ${ANSWER_RECORDED}`,
	});
	const queued = yield* waitForRecord(client, "one", (record) => record.pendingAnswers?.length === 1);
	expect(queued.pendingAnswers).toEqual([TEXT]);
	expect(queued.attempts).toEqual(current.attempts);
	return current;
});

const deliverRepair = Effect.fn("AnswerQueueTest.deliverRepair")(function* (
	fixture: ApprovedPrFixture,
	client: PrDaemonClient,
	step: "repairing" | "working",
	previous: FleetRecord,
) {
	if (step === "working") {
		const running = yield* client("fleet.reconcile", { workId: "one" });
		expect(running.pendingAnswers).toEqual([TEXT]);
		expect(running.attempts.map((entry) => entry.receipt)).toEqual(previous.attempts.map((entry) => entry.receipt));
		fixture.finishWorker(running);
	}
	yield* client("fleet.reconcile", { workId: "one" });
	const next = yield* fixture.started(client, "repair");
	const attempt = next.attempts.at(-1);
	if (attempt?.receipt === undefined || attempt.prompt === undefined) {
		return yield* Effect.die("Expected the next repair turn");
	}
	expect(attempt.role).toBe("repair");
	expect(attempt.prompt).toContain(TEXT);
	if (step === "repairing") {
		expect(attempt.prompt).toContain("Preserve the empty state.");
	}
	expect(attempt.receipt.sessionId).toBe(previous.attempts[0]?.receipt?.sessionId);
	expect(fixture.provider.observations.get(attempt.receipt.turnId)?.output).toBe(attempt.prompt);
	expect(next.pendingAnswers).toBeUndefined();
	const count = step === "working" ? 2 : 1;
	expect(repairAttempts(next)).toHaveLength(count);
	fixture.finishWorker(next);
	const reviewed = yield* client("fleet.reconcile", { workId: "one" });
	expect(reviewed.decision?.code).toBe("reviewed-pr-ready");
	expect(repairAttempts(reviewed)).toHaveLength(count);
});

test("answer during the initial worker turn queues multiple messages in order and validates text before storing", () =>
	withHost({ "one.md": task("one", "approved") }, {}, (fixture) =>
		withReadDaemon(
			fixture.host,
			(port) =>
				Effect.gen(function* () {
					const client = yield* daemonClient(port);
					const started = yield* dispatchAndWait(client, "one");
					expect(yield* client("daemon.answer", { text: "x".repeat(32_769), workId: "one" }).pipe(Effect.flip)).toMatchObject({ _tag: "BadRequest" });
					yield* answerAndWait(client, { text: TEXT, workId: "one" });
					yield* answerAndWait(client, { text: "Preserve the empty state.", workId: "one" });
					const running = yield* client("fleet.reconcile", { workId: "one" });
					expect(running.attempts.map((entry) => entry.receipt)).toEqual(started.attempts.map((entry) => entry.receipt));
					finishWorkers(fixture.provider);
					const next = yield* client("fleet.reconcile", { workId: "one" });
					expect(next.attempts.at(-1)?.prompt).toContain(`${TEXT}\n\nPreserve the empty state.`);
					expect(next.pendingAnswers).toBeUndefined();
				}),
			{ parts: fixture.parts },
		),
	));

test("queued guidance uses the current approved brief when the active turn ends", () =>
	withHost({ "one.md": task("one", "approved") }, {}, (fixture) =>
		withReadDaemon(
			fixture.host,
			(port) =>
				Effect.gen(function* () {
					const client = yield* daemonClient(port);
					const started = yield* dispatchAndWait(client, "one");
					yield* answerAndWait(client, { text: TEXT, workId: "one" });
					const current = task("one", "approved", "Use the revised acceptance criteria.");
					fixture.write("one.md", current);
					finishWorkers(fixture.provider);
					const next = yield* client("fleet.reconcile", { workId: "one" });
					expect(next.step).toBe("working");
					expect(next.boardRevision).not.toBe(started.boardRevision);
					expect(next.attempts.at(-1)?.prompt).toContain(current);
					expect(next.attempts.at(-1)?.prompt).toContain(TEXT);
					expect(next.pendingAnswers).toBeUndefined();
				}),
			{ parts: fixture.parts },
		),
	));
