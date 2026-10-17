import { Effect } from "effect";
import { Migrator } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { migrationSteps } from "#migrationSteps.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { loaderResourcesAreScoped } from "./loaderResourcesAreScoped.ts";
import { layer, migrations, seedContacts } from "./migrationSteps.ts";
import { narrated } from "./narrated.ts";
import { configured } from "./postgres.ts";
import { createSteps, stepsVerbs } from "./stepsVerbs.ts";

const kit = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => createSteps,
	layer,
	name: "backfill",
	stages: ["loader", "schema", "data"],
	verbs: (engine, story) => {
		const verbs = { ...stepsVerbs(engine), loaderResourcesAreScoped };
		return {
			backfill: narrated(story.tell, "backfill", verbs.backfill),
			backfillCommitsEachStep: narrated(story.tell, "backfill commits each step", verbs.backfillCommitsEachStep),
			emailsArePreserved: narrated(story.tell, "emails are preserved", verbs.emailsArePreserved),
			loaderResourcesAreScoped: narrated(story.tell, "loader resources are scoped", verbs.loaderResourcesAreScoped),
			stepsResumeAndRejectGoingBackwards: narrated(story.tell, "steps resume and reject going backwards", verbs.stepsResumeAndRejectGoingBackwards),
			targetIsRejected: narrated(story.tell, "target is rejected", verbs.targetIsRejected),
			targetStopsAtBackfill: narrated(story.tell, "target stops at backfill", verbs.targetStopsAtBackfill),
			wrappingTransactionsAreRejected: narrated(story.tell, "wrapping transactions are rejected", verbs.wrappingTransactionsAreRejected),
		};
	},
});

export const app = { ...kit, it: kit.it.skipIf(!configured) };
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
