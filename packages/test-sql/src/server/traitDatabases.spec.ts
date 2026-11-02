import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { selectedDatabaseRunner } from "#test/selectedDatabaseRunner.ts";

selectedDatabaseRunner.it(
	"traits select each app's startup database without changing defaults, and every clone is dropped after app teardown, including a failed story",
	[],
	function* ({ databasesAfterStories, observations, results, runStories }) {
		yield* runStories();

		const cases = [
			["Selected Migrated Database Story: empty selection", []],
			["Selected Migrated Database Story: default after empty selection", ["effect_sql_migrations", "items", "notes"]],
			["Selected Empty Database Story: migrated selection", ["effect_sql_migrations", "items", "notes"]],
			["Selected Empty Database Story: empty default after migrated selection", []],
			["Selected Migrated Database Story: failed story", []],
		] as const;
		yield* outcomes([
			[
				"app observations",
				() => observations(),
				cases.map(([story, tables], index) => ({
					closed: index === 0 ? ["story_note"] : tables,
					startup: tables,
					story,
					...(index < 2 ? { clients: { pg: index === 0 ? ["story_note"] : tables, sql: index === 0 ? ["story_note"] : tables } } : {}),
				})),
			],
			["clone cleanup", () => databasesAfterStories(), cases.map(([story]) => ({ database: "dropped", story }))],
			[
				"story outcomes",
				() => results(),
				{
					errors: [],
					stories: cases.map(([name], index) => ({
						errors: index === cases.length - 1 ? [expect.stringContaining("the app story failed on purpose")] : [],
						name,
						state: index === cases.length - 1 ? ("failed" as const) : ("passed" as const),
					})),
				},
			],
		]);
	},
);
