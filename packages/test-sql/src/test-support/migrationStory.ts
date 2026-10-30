import { Effect, Exit, Scope } from "effect";
import { Migrator } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { migrationSteps } from "#migrationSteps.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { layer, migrations, seedContacts } from "./migrationSteps.ts";
import { configured } from "./postgres.ts";
import { createSteps, stepsVerbs } from "./stepsVerbs.ts";

export const app = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => createSteps,
	inspect: ({ counts, loaderResource, migration }) => ({ loaderResource, loads: counts.loads, migration }),
	layer,
	name: "backfill",
	runIf: configured,
	stages: ["loader", "schema", "data"],
	verbs: stepsVerbs,
});

export const oldSchema = app.trait("schema", "contacts still have an email column", (engine) => engine.steps.migrateTo("1_create_contacts"));
export const existingContacts = app.trait("data", "contacts have email addresses", () => seedContacts);

export function migratedTo(target: string) {
	return app.trait("schema", `the steps already migrated to ${target}`, (engine) => engine.steps.migrateTo(target));
}

export const ambiguousLoader = app.trait("loader", "the loader has two migrations with id 1 and the name create_contacts", function* (engine) {
	engine.steps = yield* migrationSteps({
		...migrations,
		loader: Migrator.fromRecord({ "1_create_contacts": Effect.void, "001_create_contacts": Effect.void }),
	});
});

export const scopedLoader = app.trait(
	"loader",
	"the caller acquires the steps in its own scope from a loader that opens a resource",
	function* (engine) {
		const scope = yield* Effect.acquireRelease(Scope.make(), (owned) => Scope.close(owned, Exit.void));
		const loader = Effect.acquireRelease(
			Effect.andThen(
				Effect.sync(() => {
					engine.loaderResource = "open";
				}),
				migrations.loader,
			),
			() =>
				Effect.sync(() => {
					engine.loaderResource = "closed";
				}),
		);
		engine.steps = yield* migrationSteps({ ...migrations, loader }).pipe(Scope.provide(scope));
		engine.stepsScope = scope;
	},
);
