import { expect } from "vitest";
import { expiredSession, worker } from "#test-support/worker.ts";

worker.it("the worker registers a daily UTC sweep and removes expired sessions", [expiredSession], function* (app) {
	expect(yield* app.storedSessions()).toEqual([
		{ email: "alice@app.test", id: expect.any(String), userId: expect.any(String) },
		{ email: "bob@app.test", id: expect.any(String), userId: expect.any(String) },
	]);
	yield* app.startWorker();
	expect(yield* app.schedules()).toContainEqual({ cron: "0 0 * * *", name: "sweep-expired-auth-sessions", timezone: "UTC" });
	yield* app.triggerSweep();
	yield* app.waitForIdle();
	expect(yield* app.storedSessions()).toEqual([{ email: "bob@app.test", id: expect.any(String), userId: expect.any(String) }]);
});
