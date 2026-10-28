import { Effect, Fiber } from "effect";
import { expect } from "vitest";
import { notesDeployment } from "#modules/notes/test-support/deployment.ts";

notesDeployment.it(
	"SIGTERM lets an active CountWords job finish before the worker exits cleanly",
	[],
	function* ({ startProcess, signUpAt, notesAt, holdJob }) {
		const release = { "RAILWAY_GIT_COMMIT_SHA": "shutdown" };
		const migration = yield* startProcess("migrate", 0, release);
		expect(yield* migration.child.exitCode).toBe(0);
		const web = yield* startProcess("web");
		yield* web.ready;
		const session = yield* signUpAt(web.url, "shutdown");
		const notes = yield* notesAt(web.url, session.cookie);
		const note = yield* notes["notes.create"]({ title: "Finish before stopping" });
		const held = yield* holdJob(note.id);
		const worker = yield* startProcess("worker", 0, release);
		yield* worker.ready;
		yield* held.blocked;
		const stopping = yield* worker.child.kill().pipe(Effect.forkScoped);
		yield* Effect.sleep("1200 millis");
		expect(yield* worker.child.isRunning).toBe(true);
		yield* held.release;
		yield* Fiber.join(stopping);
		expect(yield* worker.child.exitCode).toBe(0);
		expect(yield* notes["notes.get"]({ id: note.id })).toMatchObject({ wordCount: 3 });
	},
	100_000,
);
