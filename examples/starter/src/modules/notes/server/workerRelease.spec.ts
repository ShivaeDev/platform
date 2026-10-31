import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { notesDeployment } from "#modules/notes/test-support/deployment.ts";

notesDeployment.it(
	"waits for its release, drains the old worker before taking over, and resumes on rollback",
	[],
	function* ({ startProcess, signUpAt, notesAt, holdJob, workerPollPasses, heartbeatWindowPasses }) {
		const oldRelease = { "RAILWAY_GIT_COMMIT_SHA": "old" };
		const newRelease = { "RAILWAY_GIT_COMMIT_SHA": "new" };
		const migration = yield* startProcess("migrate", 0, oldRelease);
		expect(yield* migration.child.exitCode).toBe(0);
		const web = yield* startProcess("web");
		const address = yield* web.ready;
		const session = yield* signUpAt(address, "handoff");
		const notes = yield* notesAt(address, session.cookie);
		const first = yield* notes["notes.create"]({ title: "Old release finishes" });
		const held = yield* holdJob(first.id);
		const oldWorker = yield* startProcess("worker", 0, oldRelease);
		yield* oldWorker.ready;
		yield* held.blocked;
		const nextWorker = yield* startProcess("worker", 0, newRelease);
		yield* nextWorker.waitingForSchema;
		const second = yield* notes["notes.create"]({ title: "New release takes over" });
		yield* workerPollPasses();
		expect(yield* notes["notes.get"]({ id: second.id })).toMatchObject({ wordCount: null });
		const nextMigration = yield* startProcess("migrate", 0, newRelease);
		expect(yield* nextMigration.child.exitCode).toBe(0);
		yield* nextWorker.ready;
		yield* heartbeatWindowPasses();
		yield* outcomes([
			["draining note", () => notes["notes.get"]({ id: first.id }), expect.objectContaining({ wordCount: null })],
			["queued note", () => notes["notes.get"]({ id: second.id }), expect.objectContaining({ wordCount: null })],
		]);
		yield* held.release;
		yield* oldWorker.paused;
		yield* Effect.promise(() =>
			expect.poll(() => Effect.runPromise(notes["notes.get"]({ id: second.id })), { timeout: 8000 }).toMatchObject({ wordCount: 4 }),
		);
		yield* outcomes([
			["paused worker process", () => oldWorker.child.isRunning, true],
			["queued note", () => notes["notes.get"]({ id: first.id }), expect.objectContaining({ wordCount: 3 })],
		]);
		const rollback = yield* startProcess("migrate", 0, oldRelease);
		expect(yield* rollback.child.exitCode).toBe(0);
		yield* nextWorker.paused;
		yield* oldWorker.resumed;
		const third = yield* notes["notes.create"]({ title: "Rollback resumes jobs" });
		yield* Effect.promise(() =>
			expect.poll(() => Effect.runPromise(notes["notes.get"]({ id: third.id })), { timeout: 8000 }).toMatchObject({ wordCount: 3 }),
		);
	},
	6 * 20_000 + 120_000,
);
