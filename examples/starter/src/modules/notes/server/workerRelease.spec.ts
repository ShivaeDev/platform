import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { notesDeployment, releaseMigrated, signedUp, webRunning } from "#modules/notes/test-support/deployment.ts";

notesDeployment.it(
	"a worker of a release that has not migrated waits and leaves queued notes uncounted",
	[releaseMigrated("old"), webRunning(), signedUp("alice")],
	function* ({ notesOf, wordCountOf, workerPollPasses, workerStartsWaiting }) {
		yield* workerStartsWaiting("new");

		const note = yield* notesOf("alice").create("New release takes over");
		yield* workerPollPasses();

		expect(yield* wordCountOf("alice", note)).toBe("not counted");
	},
	60_000,
);

notesDeployment.it(
	"while the old worker drains a held job, the migrated new release leaves queued notes alone past the heartbeat window",
	[releaseMigrated("old"), webRunning(), signedUp("alice")],
	function* ({ heartbeatWindowPasses, migrates, noteIsHeld, notesOf, wordCountBlocks, wordCountOf, workerStarts }) {
		const draining = yield* notesOf("alice").create("Old release finishes");
		yield* noteIsHeld(draining);
		yield* workerStarts("old");
		yield* wordCountBlocks();
		yield* migrates("new");
		yield* workerStarts("new");
		const queued = yield* notesOf("alice").create("New release takes over");

		yield* heartbeatWindowPasses();

		yield* outcomes([
			["draining note", () => wordCountOf("alice", draining), "not counted"],
			["queued note", () => wordCountOf("alice", queued), "not counted"],
		]);
	},
	90_000,
);

notesDeployment.it(
	"once the old worker finishes its held job it pauses, and the new release counts the queued notes",
	[releaseMigrated("old"), webRunning(), signedUp("alice")],
	function* ({ heldNoteIsReleased, migrates, noteIsHeld, notesOf, processState, wordCountArrives, wordCountBlocks, workerPauses, workerStarts }) {
		const draining = yield* notesOf("alice").create("Old release finishes");
		yield* noteIsHeld(draining);
		yield* workerStarts("old");
		yield* wordCountBlocks();
		yield* migrates("new");
		yield* workerStarts("new");
		const queued = yield* notesOf("alice").create("New release takes over");

		yield* heldNoteIsReleased();

		yield* outcomes([
			["old worker", () => workerPauses("old"), "paused"],
			["queued note", () => wordCountArrives("alice", queued), "4 words"],
			["drained note", () => wordCountArrives("alice", draining), "3 words"],
			["old worker process", () => processState("old worker"), "running"],
		]);
	},
	90_000,
);

notesDeployment.it(
	"rolling back to the old release pauses the new worker and resumes the old one, which counts new notes",
	[releaseMigrated("old"), webRunning(), signedUp("alice")],
	function* ({ migrates, notesOf, wordCountArrives, workerPauses, workerResumes, workerStarts }) {
		yield* workerStarts("old");
		yield* migrates("new");
		yield* workerStarts("new");
		expect(yield* workerPauses("old")).toBe("paused");

		yield* migrates("old");

		yield* outcomes([
			["new worker", () => workerPauses("new"), "paused"],
			["old worker", () => workerResumes("old"), "resumed"],
			["a new note", () => Effect.flatMap(notesOf("alice").create("Rollback resumes jobs"), (note) => wordCountArrives("alice", note)), "3 words"],
		]);
	},
	90_000,
);
