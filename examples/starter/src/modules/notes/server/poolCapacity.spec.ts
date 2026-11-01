import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { notesDeployment, releaseMigrated, signedUp, webRunning } from "#modules/notes/test-support/deployment.ts";

notesDeployment.it(
	"eight concurrent sessions creating and counting notes keep web and worker connections within their pools",
	[releaseMigrated("current"), webRunning({ "AUTH_RATE_LIMIT_ENABLED": "false" }), signedUp("alice")],
	function* ({ connectionsAreWatched, sessionsCreateNotesAtOnce, workerStarts }) {
		yield* workerStarts("current");
		const connections = yield* connectionsAreWatched();

		const wordCounts = yield* sessionsCreateNotesAtOnce("alice", 8);

		yield* outcomes([
			["word counts", () => Effect.succeed(wordCounts), Array.from({ length: 8 }, () => "3 words")],
			["connections", () => connections.peak(), "within the pool limits"],
		]);
	},
	120_000,
);
