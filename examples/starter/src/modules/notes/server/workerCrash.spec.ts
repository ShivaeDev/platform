import { expect } from "vitest";
import { notesDeployment, releaseMigrated, signedUp, webRunning } from "#modules/notes/test-support/deployment.ts";

notesDeployment.it(
	"a killed worker of the old release holds back the replacement until its heartbeat expires, then the replacement counts queued notes",
	[releaseMigrated("crashed"), webRunning(), signedUp("alice")],
	function* ({
		heldNoteIsReleased,
		migrates,
		noteIsHeld,
		notesOf,
		wordCountArrives,
		wordCountBlocks,
		wordCountOf,
		workerIsKilled,
		workerPollPasses,
		workerStarts,
	}) {
		const interrupted = yield* notesOf("alice").create("Interrupted by crash");
		yield* noteIsHeld(interrupted);
		yield* workerStarts("crashed");
		yield* wordCountBlocks();
		yield* migrates("replacement");
		yield* workerStarts("replacement");
		const queued = yield* notesOf("alice").create("Replacement handles queued jobs");
		yield* workerIsKilled("crashed");
		yield* heldNoteIsReleased();
		yield* workerPollPasses();
		expect(yield* wordCountOf("alice", queued)).toBe("not counted");

		const counted = yield* wordCountArrives("alice", queued);

		expect(counted).toBe("4 words");
	},
	120_000,
);
