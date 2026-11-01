import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { notesDeployment, releaseMigrated, signedUp, webRunning } from "#modules/notes/test-support/deployment.ts";

notesDeployment.it(
	"SIGTERM lets the worker finish its blocked word count before it exits cleanly",
	[releaseMigrated("current"), webRunning(), signedUp("alice")],
	function* ({
		heldNoteIsReleased,
		noteIsHeld,
		notesOf,
		processState,
		wordCountBlocks,
		wordCountOf,
		workerHasStopped,
		workerIsAskedToStop,
		workerPollPasses,
		workerStarts,
	}) {
		const note = yield* notesOf("alice").create("Finish before stopping");
		yield* noteIsHeld(note);
		yield* workerStarts("current");
		yield* wordCountBlocks();
		yield* workerIsAskedToStop("current");
		yield* workerPollPasses();
		expect(yield* processState("current worker")).toBe("running");

		yield* heldNoteIsReleased();

		yield* outcomes([
			["worker", () => workerHasStopped("current"), "exited with code 0"],
			["alice's note", () => wordCountOf("alice", note), "3 words"],
		]);
	},
	60_000,
);
