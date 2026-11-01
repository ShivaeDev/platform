import { expect } from "vitest";
import { expiredSession, worker } from "#test-support/worker.ts";

worker.it("the worker registers a daily session sweep at midnight UTC", [], function* ({ schedules, workerStarts }) {
	yield* workerStarts();

	expect(yield* schedules()).toContainEqual({ cron: "0 0 * * *", name: "sweep-expired-auth-sessions", timezone: "UTC" });
});

worker.it(
	"the session sweep removes alice's expired session and keeps bob's live one",
	[expiredSession],
	function* ({ sessionSweepRuns, storedSessions, workerStarts }) {
		yield* workerStarts();
		expect(yield* storedSessions()).toEqual(["alice@app.test", "bob@app.test"]);

		yield* sessionSweepRuns();

		expect(yield* storedSessions()).toEqual(["bob@app.test"]);
	},
);
