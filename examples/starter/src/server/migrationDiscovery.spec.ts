import { Cause, Effect, Exit } from "effect";
import { expect } from "vitest";
import { migrationFolder } from "#test-support/migrationFolder.ts";

migrationFolder.it("adding one file applies the next migration without changing the loader", [], function* ({ addMigration, migrate, storedLabels }) {
	yield* addMigration("0001_create_labels.ts", "create table folder_labels (label text primary key)");
	expect(yield* migrate()).toEqual([[1, "create_labels"]]);
	yield* addMigration("0002_seed_labels.ts", "insert into folder_labels (label) values ('Discovered')");
	expect(yield* migrate()).toEqual([[2, "seed_labels"]]);
	expect(yield* storedLabels).toEqual([{ label: "Discovered" }]);
	expect(yield* migrate()).toEqual([]);
});

migrationFolder.it("two files with the same sequential number fail with Effect's duplicate-id error", [], function* ({ addMigration, migrate }) {
	yield* addMigration("0001_create_labels.ts", "create table folder_labels (label text primary key)");
	yield* addMigration("0001_seed_labels.ts", "insert into folder_labels (label) values ('Duplicate')");
	const exit = yield* migrate().pipe(Effect.exit);
	expect(Exit.isFailure(exit)).toBe(true);
	if (Exit.isFailure(exit)) {
		expect(Cause.squash(exit.cause)).toMatchObject({ _tag: "MigrationError", kind: "Duplicates", message: "Found duplicate migration id's" });
	}
});
