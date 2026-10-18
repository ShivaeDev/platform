import { expect } from "@effect/vitest";
import { Effect, Fiber, Schedule, Stream } from "effect";
import { ANSWER_RECORDED } from "#attention.ts";
import { daemonClient, daemonRequest } from "#host/daemonClient.ts";
import { busyAdmission } from "#test/busyAdmission.ts";
import { dispatchAndWait, waitForRecord } from "#test/daemonActions.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";
import { spanCounts } from "#test/spanCounts.ts";
import { askWorker } from "#test/workerQuestion.ts";

const workIds = ["one", "two", "three"];
const TEXT = "Use PostgreSQL.";

for (const mode of ["answer", "release", "guidance"] as const) {
	postgresTests("live")(`${mode} confirms with more admission waiters than pooled connections`, () =>
		withHost(
			Object.fromEntries(workIds.map((workId) => [`${workId}.md`, task(workId, "approved")])),
			{ concurrency: 4, database: { maxConnections: 2 } },
			(fixture) => {
				const spans = spanCounts();
				return spans.trace(withReadDaemon(fixture.host, (port) => poolStory(fixture, port, mode, spans), { parts: fixture.parts }));
			},
		),
	);
}

const poolStory = Effect.fn("AnswerPoolTest.poolStory")(function* (
	fixture: HostFixture,
	port: number,
	mode: "answer" | "release" | "guidance",
	spans: ReturnType<typeof spanCounts>,
) {
	const client = yield* daemonClient(port);
	const decisions = new Map<string, string>();
	for (const workId of workIds) {
		yield* dispatchAndWait(client, workId);
		if (mode !== "guidance") {
			decisions.set(workId, (yield* askWorker(fixture.provider, workId)).decision.id);
		}
	}
	const free = yield* busyAdmission(fixture.host);
	yield* Effect.addFinalizer(() => free);
	for (const workId of workIds.slice(0, 2)) {
		const accepted = yield* daemonRequest(
			port,
			(peer) => peer("daemon.answer", { release: mode === "release", text: TEXT, workId }),
			`answer ${workId}`,
			500,
		);
		expect(accepted.blocker).toBe(ANSWER_RECORDED);
	}
	yield* Effect.sync(() => spans.count("FleetAnswer.drain")).pipe(
		Effect.repeat({ schedule: Schedule.spaced("10 millis"), until: (count) => count >= 2 }),
		Effect.timeout("5 seconds"),
	);
	const reconciliations = yield* Effect.forEach(workIds, (workId) => client("fleet.reconcile", { workId }).pipe(Effect.forkScoped));
	const args = ["answer", "three", ...(mode === "release" ? ["--release"] : [TEXT]), "--port", String(port)];
	const result = yield* Effect.promise(() => cliProcess(args)).pipe(Effect.timeout("5 seconds"));
	expect(result).toEqual({
		code: 0,
		stdout: `three ${mode === "guidance" ? "executing" : "needs-human"}: ${ANSWER_RECORDED}`,
	});
	const pending = yield* daemonRequest(port, (peer) => peer("daemon.status", {}), "status", 500);
	expect(
		pending.waiting.automation
			.filter((record) => record.blocker === ANSWER_RECORDED)
			.map((record) => record.workId)
			.sort(),
	).toEqual([...workIds].sort());
	const snapshots = yield* client("daemon.follow", { workIds }).pipe(Stream.take(1), Stream.runCollect, Effect.timeout("500 millis"));
	expect(snapshots).toEqual([[...workIds].sort().map((workId) => expect.objectContaining({ blocker: ANSWER_RECORDED, workId }))]);
	yield* free;
	for (const reconciliation of reconciliations) {
		yield* Fiber.join(reconciliation);
	}
	for (const workId of workIds) {
		const applied = yield* waitForRecord(client, workId, (record) =>
			mode === "guidance" ? record.pendingAnswers?.length === 1 : record.decision?.id !== decisions.get(workId),
		);
		if (mode === "guidance") {
			expect(applied.pendingAnswers).toEqual([TEXT]);
		} else {
			expect(applied.responses?.filter((response) => response.decisionId === decisions.get(workId))).toHaveLength(1);
			expect(applied.stage).toBe(mode === "release" ? "released" : "executing");
		}
	}
});
