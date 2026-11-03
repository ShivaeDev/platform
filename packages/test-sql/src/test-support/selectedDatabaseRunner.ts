import { fileURLToPath } from "node:url";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect } from "effect";
import { runVitest, type VitestRunResult } from "@shivaedev/test/adapters/runVitest.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { adminUrl, configured } from "./postgres.ts";
import type { AppObservation } from "./selectedApp.ts";

interface Run {
	result?: VitestRunResult;
}

export const selectedDatabaseRunner = storyKit({
	clock: "live",
	create: (): Run => ({}),
	inspect: (run) => run.result,
	layer: PgClient.layer({ url: adminUrl }),
	name: "trait-selected databases",
	runIf: configured,
	stages: [],
	verbs: (run, story) => ({
		databasesAfterStories: () => {
			story.tell("PostgreSQL reports whether each story's database remains after teardown");
			return Effect.gen(function* () {
				const sql = yield* PgClient.PgClient;
				return yield* Effect.forEach(run.result?.tests ?? [], (test) => {
					const database = test.meta.selectedDatabase?.database;
					if (database === undefined) {
						return Effect.succeed({ database: "not acquired", story: test.name });
					}
					return sql`select datname from pg_database where datname = ${database}`.pipe(
						Effect.map((rows) => ({
							database: rows.length === 0 ? "dropped" : "exists",
							story: test.name,
						})),
					);
				});
			});
		},
		observations: () => {
			story.tell("the story reads the tables observed at app startup and teardown");
			return Effect.sync(() =>
				run.result?.tests.map((test) => {
					const observation: AppObservation | undefined = test.meta.selectedDatabase;
					return { clients: observation?.clients, closed: observation?.closed, startup: observation?.tables, story: test.name };
				}),
			);
		},
		results: () => {
			story.tell("the story reads each app story's outcome and errors");
			return Effect.sync(() => ({
				errors: [...(run.result?.moduleErrors ?? []), ...(run.result?.unhandledErrors ?? [])],
				stories: run.result?.tests.map(({ errors, name, state }) => ({ errors, name, state })),
			}));
		},
		runStories: () => {
			story.tell("Vitest runs app stories with trait-selected databases");
			return runVitest({ include: "src/test-support/selectedDatabaseStories.ts", root: fileURLToPath(new URL("../..", import.meta.url)) }).pipe(
				Effect.tap((result) =>
					Effect.sync(() => {
						run.result = result;
					}),
				),
			);
		},
	}),
});
