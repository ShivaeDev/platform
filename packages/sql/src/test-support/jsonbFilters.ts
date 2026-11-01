import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { jsonb } from "#jsonb.ts";
import { makeRepository } from "#repository.ts";
import type { FindManyFilter, RepositoryListFilter } from "#repositoryFilter.ts";
import { onPostgres } from "./engines.ts";
import { ownTable, uniqueTable } from "./writeTables.ts";

class Profile extends Model.Class<Profile>("JsonbFilterProfile")({
	details: jsonb(
		Schema.NullOr(
			Schema.Struct({
				gt: Schema.optionalKey(Schema.NumberFromString),
				in: Schema.optionalKey(Schema.Array(Schema.NumberFromString)),
			}),
		),
	),
	id: Schema.Int,
}) {}

const jsonbFilterEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = uniqueTable("jsonb_filters");
	yield* ownTable(sql, tableName, sql`id integer primary key, details jsonb`);
	const profiles = yield* makeRepository(Profile, { idColumn: "id", spanPrefix: "Profile", tableName });
	return { profiles, sql, tableName };
});

type JsonbFilterEngine = Effect.Success<ReturnType<typeof jsonbFilterEngine>>;

export const jsonbFilters = storyKit({
	...onPostgres,
	create: jsonbFilterEngine,
	name: "PostgreSQL JSONB filters",
	stages: ["rows"],
	verbs: ({ profiles }: JsonbFilterEngine, story) => ({
		countProfiles: (where: FindManyFilter<typeof Profile>) =>
			Effect.suspend(() => {
				story.tell("the repository counts profiles matching the details filter");
				return profiles.count({ where });
			}),
		deleteProfiles: (where: RepositoryListFilter<typeof Profile>) =>
			Effect.suspend(() => {
				story.tell("the repository deletes profiles matching the details filter");
				return profiles.delete(where);
			}),
		findProfiles: (where: FindManyFilter<typeof Profile>) =>
			Effect.suspend(() => {
				story.tell("the repository reads profiles matching the details filter");
				return profiles.findMany({ orderBy: { direction: "asc", field: "id" }, select: ["id"], where });
			}),
		remainingProfiles: () => profiles.findMany({ orderBy: { direction: "asc", field: "id" }, select: ["id"] }),
	}),
});

export function distinctDetails() {
	return jsonbFilters.trait(
		"rows",
		"profiles store SQL NULL (1 and 7), JSON null (2), gt 7 (3), gt 8 (4), in [7] (5), and gt 7 with in [7] (6), with numbers encoded as strings",
		({ sql, tableName }) =>
			Effect.asVoid(sql`insert into ${sql(tableName)} (id, details) values
				(1, null), (2, 'null'::jsonb), (3, '{"gt":"7"}'::jsonb),
				(4, '{"gt":"8"}'::jsonb), (5, '{"in":["7"]}'::jsonb), (6, '{"gt":"7","in":["7"]}'::jsonb), (7, null)`),
	);
}
