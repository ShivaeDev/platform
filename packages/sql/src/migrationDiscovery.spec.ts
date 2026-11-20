import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { discoveredMigrations, folderApplied, folderMissing } from "#test/discoveredMigrations.ts";

discoveredMigrations.it(
	"adding a higher-numbered file to the migrations folder applies only that migration on the next run",
	[folderApplied("0001_create_labels.ts", "create table folder_labels (label text primary key)")],
	function* ({ addMigration, labels, migrate, runs }) {
		yield* addMigration("0002_seed_labels.ts", "insert into folder_labels (label) values ('Discovered')");

		yield* migrate();

		yield* outcomes([
			["labels", () => labels(), ["Discovered"]],
			["runs", () => runs(), [[[2, "seed_labels"]]]],
		]);
	},
);

discoveredMigrations.it(
	"a directory without a migrations folder fails the run with a message naming the folder it looked for instead of applying nothing",
	[folderMissing],
	function* ({ migrate, runs }) {
		yield* migrate();

		expect(yield* runs()).toEqual([
			'failed with a failed migration: Cannot read the migrations folder <directory>/migrations: pass the folder that contains "migrations"',
		]);
	},
);
