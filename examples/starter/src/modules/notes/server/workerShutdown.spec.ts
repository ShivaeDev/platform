import { Effect, Fiber } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { notesDeployment } from "#modules/notes/test-support/deployment.ts";

notesDeployment.it(
	"SIGTERM lets an active CountWords job finish before the worker exits cleanly",
	[],
	function* ({ startProcess, signUpAt, notesAt, holdJob, workerPollPasses }) {
		const release = { "RAILWAY_GIT_COMMIT_SHA": "shutdown" };
		const migration = yield* startProcess("migrate", 0, release);
		expect(yield* migration.child.exitCode).toBe(0);
		const web = yield* startProcess("web");
		const address = yield* web.ready;
		const session = yield* signUpAt(address, "shutdown");
		const notes = yield* notesAt(address, session.cookie);
		const note = yield* notes["notes.create"]({ title: "Finish before stopping" });
		const held = yield* holdJob(note.id);
		const worker = yield* startProcess("worker", 0, release);
		yield* worker.ready;
		yield* held.blocked;
		const stopping = yield* worker.child.kill().pipe(Effect.forkScoped);
		yield* workerPollPasses();
		expect(yield* worker.child.isRunning).toBe(true);
		yield* held.release;
		yield* Fiber.join(stopping);
		yield* outcomes({
			"finished note": [notes["notes.get"]({ id: note.id }), expect.objectContaining({ wordCount: 3 })],
			"worker exit code": [worker.child.exitCode.pipe(Effect.map(Number)), 0],
		});
	},
	3 * 20_000 + 40_000,
);
