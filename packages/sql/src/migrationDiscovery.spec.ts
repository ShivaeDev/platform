import { expect } from "vitest";
import { migrationFolder } from "#test/migrationFolder.ts";

migrationFolder.it("adding one file applies the next migration without changing the loader", [], function* ({ addMigration, migrate, storedLabels }) {
	yield* addMigration("0001_create_labels.ts", "create table folder_labels (label text primary key)");
	expect(yield* migrate()).toEqual([[1, "create_labels"]]);
	yield* addMigration("0002_seed_labels.ts", "insert into folder_labels (label) values ('Discovered')");
	expect(yield* migrate()).toEqual([[2, "seed_labels"]]);
	expect(yield* storedLabels).toEqual([{ label: "Discovered" }]);
	expect(yield* migrate()).toEqual([]);
});
