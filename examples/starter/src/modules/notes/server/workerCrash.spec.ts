import { Effect } from "effect";
import { expect } from "vitest";
import { notesDeployment } from "#modules/notes/test-support/deployment.ts";

const SUCCESS_EXIT = 0;

notesDeployment.it(
	"a killed old worker stops blocking the owning release after its heartbeat expires",
	[],
	function* ({ startProcess, signUpAt, notesAt, holdJob }) {
		const oldRelease = { "RAILWAY_GIT_COMMIT_SHA": "crashed" };
		const newRelease = { "RAILWAY_GIT_COMMIT_SHA": "replacement" };
		const migration = yield* startProcess("migrate", 0, oldRelease);
		expect(yield* migration.child.exitCode).toBe(SUCCESS_EXIT);
		const web = yield* startProcess("web");
		yield* web.ready;
		const session = yield* signUpAt(web.url, "crash");
		const notes = yield* notesAt(web.url, session.cookie);
		const first = yield* notes["notes.create"]({ title: "Interrupted by crash" });
		const held = yield* holdJob(first.id);
		const oldWorker = yield* startProcess("worker", 0, oldRelease);
		yield* oldWorker.ready;
		yield* held.blocked;
		const nextMigration = yield* startProcess("migrate", 0, newRelease);
		expect(yield* nextMigration.child.exitCode).toBe(SUCCESS_EXIT);
		const nextWorker = yield* startProcess("worker", 0, newRelease);
		yield* nextWorker.ready;
		const second = yield* notes["notes.create"]({ title: "Replacement handles queued jobs" });
		yield* oldWorker.child.kill({ killSignal: "SIGKILL" });
		yield* held.release;
		yield* Effect.sleep("1200 millis");
		expect(yield* notes["notes.get"]({ id: second.id })).toMatchObject({ wordCount: null });
		yield* Effect.promise(() =>
			expect.poll(() => Effect.runPromise(notes["notes.get"]({ id: second.id })), { timeout: 8000 }).toMatchObject({ wordCount: 4 }),
		);
	},
	45_000,
);
