import { BigDecimal, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { crossTableReads } from "#test/cross-table/reads.ts";
import { onPostgres } from "./engines.ts";
import { type QueryEngine, queryEngine } from "./queryEngine.ts";
import { queryVerbs } from "./queryVerbs.ts";

export const queries = storyKit({
	...onPostgres,
	create: queryEngine,
	inspect: (engine: QueryEngine) => ({ announced: engine.announced, statements: engine.statements }),
	name: "PostgreSQL queries",
	stages: ["rows"],
	verbs: (engine: QueryEngine, story) => queryVerbs(engine, story.tell),
});

export const resultRows = [
	{ durationMs: 2, failed: true, file: "a.test.ts", id: 1, project: "web", weight: BigDecimal.fromStringUnsafe("9007199254740993.125") },
	{ durationMs: 3, failed: false, file: "a.test.ts", id: 2, project: "web", weight: null },
	{ durationMs: 20, failed: true, file: "a.test.ts", id: 3, project: "api", weight: BigDecimal.fromStringUnsafe("0.125") },
	{ durationMs: 9, failed: false, file: "b.test.ts", id: 4, project: "web", weight: BigDecimal.fromStringUnsafe("0.25") },
	{ durationMs: 1, failed: null, file: "c.test.ts", id: 5, project: "api", weight: null },
];

export function testResults() {
	return queries.trait(
		"rows",
		"five test results: a.test.ts has two web and one api result, b.test.ts one web result, c.test.ts one api result with no outcome or weight",
		({ results }) => Effect.asVoid(results.insertMany(resultRows)),
	);
}

export function durationsAreNumeric() {
	return queries.trait(
		"rows",
		"the duration column is numeric, which PostgreSQL returns as text that the integer duration field rejects",
		({ sql, tables }) => Effect.asVoid(sql`alter table ${sql(tables.results)} alter column "durationMs" type numeric`),
	);
}

export function sourceRows() {
	return queries.trait("rows", "four sources: first (10), second (20) and fourth (40) are flaky, stable (30) is not", ({ sources }) =>
		Effect.asVoid(
			sources.insertMany([
				{ amount: 10, displayName: "first", sourceKey: 1, status: "flaky" },
				{ amount: 20, displayName: "second", sourceKey: 2, status: "flaky" },
				{ amount: 30, displayName: "stable", sourceKey: 3, status: "stable" },
				{ amount: 40, displayName: "fourth", sourceKey: 4, status: "flaky" },
			]),
		),
	);
}

export const RUNS = 27_000;

export function indexedRuns() {
	return queries.trait(
		"rows",
		`${RUNS} runs: repository 1 holds ids 1-9000, 2 holds 9001-18000 and 3 the rest, each third of a repository is build, deploy or no workflow, even ids are completed, and indexes lead with the repository and the repository and workflow`,
		({ sql, tables }) =>
			Effect.gen(function* () {
				yield* sql`create index on ${sql(tables.runs)} (repository, id desc)`;
				yield* sql`create index on ${sql(tables.runs)} (repository, workflow, id desc)`;
				yield* sql`insert into ${sql(tables.runs)} select id, (id - 1) / 9000 + 1,
					case (id - 1) / 3000 % 3 when 0 then 'build' when 1 then 'deploy' else null end,
					case id % 2 when 0 then 'completed' else 'queued' end from generate_series(1, ${RUNS}) as id`;
				yield* sql`analyze ${sql(tables.runs)}`;
			}),
	);
}

export function dashboardRows() {
	return queries.trait(
		"rows",
		"pull requests First (10:00), Unreported (11:00) and Latest (12:00 UTC) live in one table, and reports 10 (score 7) for First and 30 (score 9) for Latest in another",
		function* (engine) {
			engine.dashboard.reads = yield* crossTableReads;
		},
	);
}

export function reportScoreIsInvalid() {
	return queries.trait("rows", "report 30's stored score is the text 'invalid'", function* ({ dashboard, sql }) {
		const reports = dashboard.reads?.tables.reports ?? "";
		yield* sql`update ${sql(reports)} set score = 'invalid' where id = 30`;
	});
}
