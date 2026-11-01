import { expect } from "vitest";
import { notesDeployment, releaseMigrated, signedUp, webRunning } from "#modules/notes/test-support/deployment.ts";

notesDeployment.it(
	"eight concurrent sessions leave at most ten app connections after creating and counting notes",
	[releaseMigrated("current"), webRunning({ "AUTH_RATE_LIMIT_ENABLED": "false" }), signedUp("alice")],
	function* ({ openConnections, sessionsCreateNotesAtOnce, workerStarts }) {
		yield* workerStarts("current");

		const wordCounts = yield* sessionsCreateNotesAtOnce("alice", 8);

		const connections = yield* openConnections();
		expect(wordCounts).toEqual(Array.from({ length: 8 }, () => "3 words"));
		expect(connections).toBeGreaterThan(0);
		expect(connections).toBeLessThanOrEqual(10);
	},
	120_000,
);
