import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { appInstance as app } from "#test/appInstance.ts";

app.it(
	"an app owns a private socket-only database, backs up migrations and keeps its data across scope restarts",
	[],
	function* ({
		start,
		startFromPath,
		migrate,
		aSecondPasses,
		storedValue,
		backupContents,
		socketPermissions,
		tcpPortOpen,
		clusterRunning,
		stop,
		socketDirectoryExists,
	}) {
		yield* startFromPath();
		yield* migrate("original");
		expect(yield* storedValue()).toBe("original");

		yield* aSecondPasses();
		yield* migrate("saved");

		yield* outcomes([
			["stored value", () => storedValue(), "saved"],
			["backup of previous data", () => backupContents(), [expect.any(String), expect.stringContaining("\noriginal\n")]],
			["socket directory permissions", () => socketPermissions(), "700"],
			["TCP listener", () => tcpPortOpen(), false],
			["running cluster", () => clusterRunning(), true],
		]);

		yield* stop();

		yield* outcomes([
			["stopped cluster", () => clusterRunning(), false],
			["removed socket directory", () => socketDirectoryExists(), false],
		]);

		yield* start();

		expect(yield* storedValue()).toBe("saved");
	},
	60_000,
);

app.it(
	"migrations back up the previous data and retain only the newest configured dumps",
	[],
	function* ({ start, migrate, backupContents, aSecondPasses }) {
		yield* start();
		yield* migrate("one");
		yield* aSecondPasses();
		yield* migrate("two");

		yield* aSecondPasses();
		yield* migrate("three");

		expect(yield* backupContents()).toEqual([expect.stringContaining("\none\n"), expect.stringContaining("\ntwo\n")]);
	},
	60_000,
);

app.it(
	"a different data major version is refused with a typed reason",
	[],
	function* ({ start, stop, markDifferentMajor, tryStart, outcome }) {
		yield* start();
		yield* stop();
		yield* markDifferentMajor();

		yield* tryStart();

		expect(yield* outcome()).toBe("data belongs to PostgreSQL 99");
	},
	60_000,
);

app.it(
	"a backup write failure prevents the migration from changing stored data",
	[],
	function* ({ start, migrate, denyBackupWrites, tryMigrate, outcome, storedValue }) {
		yield* start();
		yield* migrate("before");
		yield* denyBackupWrites();

		yield* tryMigrate("after");

		yield* outcomes([
			["migration refusal", () => outcome(), "backup permission denied"],
			["stored value", () => storedValue(), "before"],
		]);
	},
	60_000,
);
