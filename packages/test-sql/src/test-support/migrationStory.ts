import { Effect } from "effect";
import { Migrator } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { migrationSteps } from "#migrationSteps.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { loaderResourcesAreScoped } from "./loaderResourcesAreScoped.ts";
import { layer, migrations, seedContacts } from "./migrationSteps.ts";
import { configured } from "./postgres.ts";
import { createSteps, stepsVerbs } from "./stepsVerbs.ts";

export const app = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => createSteps,
	layer,
	name: "backfill",
	runIf: configured,
	stages: ["loader", "schema", "data"],
	verbs: (engine) => ({ ...stepsVerbs(engine), loaderResourcesAreScoped }),
});

export const oldSchema = app.trait("schema", "contacts still have an email column", (engine) => engine.steps.migrateTo("1_create_contacts"));
export const existingContacts = app.trait("data", "contacts have email addresses", () => seedContacts);
export function migrationTarget(target: string | number) {
	return app.trait("schema", `the migration target is ${JSON.stringify(target)}`, (engine) => {
		engine.target = target;
	});
}
export const ambiguousLoader = app.trait("loader", "the loader has duplicate migration identities", function* (engine) {
	engine.steps = yield* migrationSteps({
		...migrations,
		loader: Migrator.fromRecord({ "1_create_contacts": Effect.void, "001_create_contacts": Effect.void }),
	});
});
