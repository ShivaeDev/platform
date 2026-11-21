import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { accountData } from "#server/better-auth/accountData.ts";
import { ownedModels } from "#test/better-auth/ownedModels.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";

// A job or script that calls identity without the host's collector, unlike ownedData whose stories each provide one.
export const uncollectedData = storyKit({
	around: withIdentityDatabase,
	clock: storyClock,
	create: () => ({ data: accountData({ options: {} }) }),
	layer: postgres,
	name: "account data outside a host",
	runIf: databaseUrl !== undefined,
	stages: ["repositories"],
	verbs: (engine, story) => ({
		check: () => {
			story.tell("a script runs identity's coverage check without a collector");
			return engine.data.check.pipe(
				Effect.as("ran"),
				Effect.catchTag("OwnedModelsUncollected", ({ message }) => Effect.succeed(message)),
			);
		},
		erase: (userId: string) => {
			story.tell(`a job erases ${userId}'s owned rows without a collector`);
			return engine.data.eraseOwnedRows(userId).pipe(
				Effect.as("ran"),
				Effect.catchTag("OwnedModelsUncollected", ({ message }) => Effect.succeed(message)),
			);
		},
		exportAccount: (userId: string) => {
			story.tell(`a job exports ${userId}'s account without a collector`);
			return engine.data.exportAccount(userId).pipe(
				Effect.as("ran"),
				Effect.catchTag("OwnedModelsUncollected", ({ message }) => Effect.succeed(message)),
			);
		},
	}),
});

export const notesRepository = uncollectedData.trait(
	"repositories",
	"a notes repository whose model marks its owner is built with no collector",
	function* () {
		yield* ownedModels.notes;
	},
);
