import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, existingContacts, migratedTo, oldSchema } from "#test/migrationStory.ts";
import { upgrade } from "#test/upgradeStory.ts";

for (const target of [1, 2, 3]) {
	app.it(
		`migrating to ${target} leaves current-schema components and the release unapplied`,
		[],
		function* ({ appliedMigrations, migrateTo, migration, recordedRelease, tables }) {
			yield* migrateTo(target);

			yield* outcomes([
				["migration outcome", () => migration(), "succeeded"],
				["applied migrations", () => appliedMigrations(), [1, 2, 3].filter((id) => id <= target)],
				["schema relations", () => tables(), target === 1 ? ["BackfillMigrations", "contacts"] : ["BackfillMigrations", "contacts", "emails"]],
				["recorded release", () => recordedRelease(), "none"],
			]);
		},
	);
}

app.it(
	"migrating to latest installs the current-schema component and publishes the release",
	[oldSchema, existingContacts],
	function* ({ backfill, directoryAddresses, recordedRelease }) {
		expect(yield* recordedRelease()).toBe("none");

		yield* backfill();

		yield* outcomes([
			[
				"directory addresses",
				() => directoryAddresses(),
				[
					{ address: "alice@example.test", contactId: 1 },
					{ address: "bob@example.test", contactId: 2 },
				],
			],
			["recorded release", () => recordedRelease(), "contacts-current"],
		]);
	},
);

app.it(
	"migrating to latest installs components and publishes the release even when every numbered migration is applied",
	[migratedTo("3_drop_email")],
	function* ({ backfill, recordedRelease, tables }) {
		yield* outcomes([
			["schema relations", () => tables(), ["BackfillMigrations", "contacts", "emails"]],
			["recorded release", () => recordedRelease(), "none"],
		]);

		yield* backfill();

		yield* outcomes([
			[
				"schema relations",
				() => tables(),
				["BackfillMigrations", "BackfillMigrations_release", "BackfillMigrations_workers", "contact_directory", "contacts", "emails"],
			],
			["recorded release", () => recordedRelease(), "contacts-current"],
		]);
	},
);

upgrade.it(
	"an upgrade starts with step 1's columns and no release before installing current-schema components and publishing the release",
	[],
	function* ({
		columnsSeenByLaterMigration,
		currentItemNames,
		recordedRelease,
		releaseSeenByLaterMigration,
		upgradeOutcome,
		upgradeWatchedByLaterMigration,
	}) {
		yield* upgradeWatchedByLaterMigration();

		yield* outcomes([
			["upgrade outcome", () => upgradeOutcome(), "succeeded"],
			["starting columns", () => columnsSeenByLaterMigration(), ["id", "old_name", "removed"]],
			["starting release", () => releaseSeenByLaterMigration(), "none"],
			["current item names", () => currentItemNames(), ["kept"]],
			["recorded release", () => recordedRelease(), "items-current"],
		]);
	},
);
