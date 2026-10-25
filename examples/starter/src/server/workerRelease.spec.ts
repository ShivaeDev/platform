import { Effect } from "effect";
import { expect } from "vitest";
import { deployment } from "#test-support/deployment.ts";

const SUCCESS_EXIT = 0;

deployment.it(
	"waits for its release, drains the old worker before taking over, and resumes on rollback",
	[],
	function* ({ startProcess, signUpAt, notesAt, holdNoteJob }) {
		const oldRelease = { "RAILWAY_GIT_COMMIT_SHA": "old" };
		const newRelease = { "RAILWAY_GIT_COMMIT_SHA": "new" };
		const migration = yield* startProcess("migrate", 0, oldRelease);
		expect(yield* migration.child.exitCode).toBe(SUCCESS_EXIT);
		const web = yield* startProcess("web");
		yield* web.ready;
		const session = yield* signUpAt(web.url, "handoff");
		const notes = yield* notesAt(web.url, session.cookie);
		const first = yield* notes["notes.create"]({ title: "Old release finishes" });
		const held = yield* holdNoteJob(first.id);
		const oldWorker = yield* startProcess("worker", 0, oldRelease);
		yield* oldWorker.ready;
		yield* held.blocked;
		const nextWorker = yield* startProcess("worker", 0, newRelease);
		yield* nextWorker.waitingForSchema;
		const second = yield* notes["notes.create"]({ title: "New release takes over" });
		yield* Effect.sleep("1200 millis");
		expect(yield* notes["notes.get"]({ id: second.id })).toMatchObject({ wordCount: null });
		const nextMigration = yield* startProcess("migrate", 0, newRelease);
		expect(yield* nextMigration.child.exitCode).toBe(SUCCESS_EXIT);
		yield* nextWorker.ready;
		// Hold beyond the heartbeat staleness window to exercise heartbeats during drain.
		yield* Effect.sleep("6 seconds");
		expect(yield* notes["notes.get"]({ id: second.id })).toMatchObject({ wordCount: null });
		expect(yield* notes["notes.get"]({ id: first.id })).toMatchObject({ wordCount: null });
		yield* held.release;
		yield* oldWorker.paused;
		yield* Effect.promise(() =>
			expect.poll(() => Effect.runPromise(notes["notes.get"]({ id: second.id })), { timeout: 8000 }).toMatchObject({ wordCount: 4 }),
		);
		expect(yield* notes["notes.get"]({ id: first.id })).toMatchObject({ wordCount: 3 });
		expect(yield* oldWorker.child.isRunning).toBe(true);
		const rollback = yield* startProcess("migrate", 0, oldRelease);
		expect(yield* rollback.child.exitCode).toBe(SUCCESS_EXIT);
		yield* nextWorker.paused;
		yield* oldWorker.resumed;
		const third = yield* notes["notes.create"]({ title: "Rollback resumes jobs" });
		yield* Effect.promise(() =>
			expect.poll(() => Effect.runPromise(notes["notes.get"]({ id: third.id })), { timeout: 8000 }).toMatchObject({ wordCount: 3 }),
		);
	},
	60_000,
);
