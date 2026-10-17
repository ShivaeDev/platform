import { Effect } from "effect";
import { expect } from "vitest";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { migrationSteps } from "#migrationSteps.ts";
import { emails, expectedEmails, layer, migrations, seedContacts } from "#test/migrationSteps.ts";
import { configured } from "#test/postgres.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";

export const app = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => migrationSteps(migrations),
	layer,
	name: "backfill",
	runIf: configured,
	stages: ["schema", "data"],
	verbs: (steps) => ({
		backfill: () => steps.migrateToLatest,
		emailsArePreserved: () =>
			Effect.gen(function* () {
				expect(yield* emails).toEqual(expectedEmails);
			}),
	}),
});

export const oldSchema = app.trait("schema", "contacts still have an email column", (steps) => steps.migrateTo("1_create_contacts"));
export const existingContacts = app.trait("data", "contacts have email addresses", () => seedContacts);
