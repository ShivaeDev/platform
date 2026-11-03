import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { configured, database } from "#test/database.ts";
import { makeEngine } from "#test/engine.ts";
import { verbs } from "#test/verbs.ts";

export const reconciliation = storyKit({
	around: withIsolatedDatabase,
	create: () => makeEngine,
	layer: database,
	name: "PostgreSQL reconciliation",
	runIf: configured,
	stages: [],
	verbs,
});
