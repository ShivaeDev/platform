import { expect } from "vitest";
import {
	differentAutoUpdateWindow,
	differentRetention,
	missingAutoUpdateReadBack,
	missingWeekly,
	postgresSchedules,
} from "#test-support/postgresSchedulesStory.ts";

postgresSchedules.it("a check reports matching backup kinds and auto-update windows without writing", [], function* ({ check, changes }) {
	const report = yield* check();

	expect(report.clean).toBe(true);
	expect(yield* changes()).toEqual([]);
});

postgresSchedules.it("an apply leaves matching Railway schedules untouched", [], function* ({ apply, changes }) {
	const report = yield* apply();

	expect(report.clean).toBe(true);
	expect(yield* changes()).toEqual([]);
});

postgresSchedules.it(
	"an apply creates a missing weekly backup and preserves existing retention",
	[missingWeekly, differentRetention],
	function* ({ apply, changes }) {
		const report = yield* apply();

		expect(report.backupKinds.missing).toEqual([]);
		expect(report.backupKinds.schedules).toContainEqual(expect.objectContaining({ kind: "DAILY", retentionSeconds: 86_400 }));
		expect(yield* changes()).toEqual(["backup kinds: DAILY,WEEKLY,MONTHLY"]);
	},
);

postgresSchedules.it(
	"an apply replaces a different auto-update window with the declared windows",
	[differentAutoUpdateWindow],
	function* ({ apply, changes }) {
		const report = yield* apply();

		expect(report.autoUpdates.status).toBe("match");
		expect(yield* changes()).toEqual(["auto-update windows"]);
	},
);

postgresSchedules.it(
	"a backup retention difference is reported as Railway information without an apply",
	[differentRetention],
	function* ({ check, changes }) {
		const report = yield* check();

		expect(report.clean).toBe(true);
		expect(report.backupKinds.schedules[0]).toMatchObject({ kind: "DAILY", retentionSeconds: 86_400 });
		expect(yield* changes()).toEqual([]);
	},
);

postgresSchedules.it(
	"a check reports auto-updates unknown when environment config has no read-back",
	[missingAutoUpdateReadBack],
	function* ({ check, changes }) {
		const report = yield* check();

		expect(report.autoUpdates.status).toBe("unknown");
		expect(yield* changes()).toEqual([]);
	},
);

postgresSchedules.it(
	"an apply writes declared windows when environment config has no auto-update read-back",
	[missingAutoUpdateReadBack],
	function* ({ apply, changes }) {
		const report = yield* apply();

		expect(report.autoUpdates.status).toBe("match");
		expect(yield* changes()).toEqual(["auto-update windows"]);
	},
);
