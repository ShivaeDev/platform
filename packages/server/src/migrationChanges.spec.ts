import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { migrationChangesStory } from "#test/migration-changes/story.ts";

migrationChangesStory.it(
	"hosted migration writes refresh another process's subscriber exactly once",
	[],
	function* ({ anotherProcessMigrates, deliveries, nextSubscriberRows }) {
		expect(yield* nextSubscriberRows()).toEqual([]);

		const exitCode = yield* anotherProcessMigrates();
		expect(exitCode).toBe(0);

		yield* outcomes([
			["deliveries", () => deliveries(), { first: 1, list: 1, second: 1 }],
			["subscriber rows", () => nextSubscriberRows(), ["Published", "Another note"]],
		]);

		const replayExitCode = yield* anotherProcessMigrates();
		expect(replayExitCode).toBe(0);

		expect(yield* deliveries()).toEqual({ first: 1, list: 1, second: 1 });
	},
);

migrationChangesStory.it(
	"a later migration failure rolls back writes without refreshing another process's subscriber",
	[],
	function* ({ anotherProcessMigrates, currentRows, deliveries, nextSubscriberRows }) {
		expect(yield* nextSubscriberRows()).toEqual([]);

		const exitCode = yield* anotherProcessMigrates("rollback");
		expect(exitCode).toBe(1);

		yield* outcomes([
			["deliveries", () => deliveries(), { first: 0, list: 0, second: 0 }],
			["database rows", () => currentRows(), []],
		]);
	},
);
