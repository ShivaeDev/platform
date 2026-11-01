import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adminScreen, adminScreens, countedNotes, twoFailedJobs } from "#modules/notes/test-support/admin/screens.tsx";

adminScreens.it("the Jobs page filters by the app's note word-count queue", [adminScreen()], function* ({ queueFilter, settle }) {
	yield* settle();

	expect(yield* queueFilter()).toEqual(["count-note-words"]);
});

adminScreens.it(
	"a failed note job opens its detail without a Retry job control",
	[twoFailedJobs, adminScreen()],
	function* ({ failedJobs, offers, openJob, opensFailedJob, settle }) {
		yield* settle();
		expect(yield* failedJobs()).toEqual(["first-job", "second-job"]);

		yield* opensFailedJob("first-job");

		yield* outcomes([
			["detail", openJob, "first-job"],
			["Retry job", () => offers("Retry job"), "not offered"],
		]);
	},
);

adminScreens.it(
	"a session change closes the admin streams and clears the failed jobs and the open detail",
	[twoFailedJobs, adminScreen()],
	function* ({ changesSession, failedJobs, liveAdminStreams, openJob, opensFailedJob, settle }) {
		yield* settle();
		yield* opensFailedJob("first-job");
		yield* outcomes([
			["detail before", openJob, "first-job"],
			["streams before", liveAdminStreams, "open"],
		]);

		yield* changesSession();
		yield* settle();

		yield* outcomes([
			["failed jobs", failedJobs, []],
			["detail", openJob, "no detail"],
			["streams", liveAdminStreams, "none open"],
		]);
	},
);

adminScreens.it(
	"the admin navigation opens note statistics with the app's counts",
	[countedNotes, adminScreen()],
	function* ({ heading, noteStatistics, opensNoteStatistics, settle }) {
		yield* settle();

		yield* opensNoteStatistics();

		yield* outcomes([
			["page", heading, "Note statistics"],
			["statistics", noteStatistics, { Notes: "7", "Pending counts": "2", Words: "53" }],
		]);
	},
);

adminScreens.it(
	"a user without users.read sees Permission denied on the users page and opens no admin stream",
	[adminScreen("/admin/users", "user")],
	function* ({ heading, liveAdminStreams, settle, shown }) {
		yield* settle();

		yield* outcomes([
			["page", heading, "Permission denied"],
			["users table", () => shown('[aria-label="App users"]'), "hidden"],
			["streams", liveAdminStreams, "none open"],
		]);
	},
);
