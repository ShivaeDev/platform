import { expect } from "@effect/vitest";
import { Effect, Fiber, Schedule, Stream } from "effect";
import { ANSWER_RECORDED } from "#attention.ts";
import { answers, answerWork } from "#test/answerHost.ts";

const workIds = ["one", "two", "three"];
const TEXT = "Use PostgreSQL.";
const smallPool = answerWork(workIds, { concurrency: 4, database: { maxConnections: 2 } });

for (const mode of ["answer", "release", "guidance"] as const) {
	answers.it(`${mode} confirms with more admission waiters than pooled connections`, [smallPool], function* (host) {
		const decisions = new Map<string, string>();
		for (const workId of workIds) {
			yield* host.dispatch(workId);
			if (mode !== "guidance") {
				decisions.set(workId, (yield* host.question(workId)).decision.id);
			}
		}
		const free = yield* host.holdAdmission();
		for (const workId of workIds.slice(0, 2)) {
			expect((yield* host.answer(TEXT, mode === "release", workId)).blocker).toBe(ANSWER_RECORDED);
		}
		yield* Effect.sync(host.drainCount).pipe(
			Effect.repeat({ schedule: Schedule.spaced("10 millis"), until: (count) => count >= 2 }),
			Effect.timeout("5 seconds"),
		);
		const reconciliations = yield* Effect.forEach(workIds, (workId) => host.reconcile(workId).pipe(Effect.forkScoped));
		const result = yield* host.cliAnswer("three", TEXT, mode === "release").pipe(Effect.timeout("5 seconds"));
		expect(result).toEqual({ code: 0, stderr: "", stdout: `three ${mode === "guidance" ? "executing" : "needs-human"}: ${ANSWER_RECORDED}` });
		const pending = yield* host.status();
		expect(
			pending.waiting.automation
				.filter((record) => record.blocker === ANSWER_RECORDED)
				.map((record) => record.workId)
				.sort(),
		).toEqual([...workIds].sort());
		const snapshots = yield* host.follow(workIds).pipe(Stream.take(1), Stream.runCollect, Effect.timeout("500 millis"));
		expect(snapshots).toEqual([[...workIds].sort().map((workId) => expect.objectContaining({ blocker: ANSWER_RECORDED, workId }))]);
		yield* free;
		for (const reconciliation of reconciliations) {
			yield* Fiber.join(reconciliation);
		}
		for (const workId of workIds) {
			const applied = yield* host.waitForRecord(workId, (record) =>
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
}
