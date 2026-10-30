import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { discoveredMigrations, folderApplied } from "#test/discoveredMigrations.ts";

discoveredMigrations.it(
	"adding a higher-numbered file to the migrations folder applies only that migration on the next run",
	[folderApplied("0001_create_labels.ts", "create table folder_labels (label text primary key)")],
	function* ({ addMigration, labels, migrate, runs }) {
		yield* addMigration("0002_seed_labels.ts", "insert into folder_labels (label) values ('Discovered')");

		yield* migrate();

		yield* outcomes({
			labels: [labels(), ["Discovered"]],
			runs: [runs(), [[[2, "seed_labels"]]]],
		});
	},
);
