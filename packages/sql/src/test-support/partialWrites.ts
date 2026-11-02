import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { makeCapture } from "@shivaedev/changes/capture.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makeRepository } from "#repository.ts";
import { onPostgres } from "./engines.ts";
import { original, Profile } from "./partialWriteModels.ts";
import { partialWriteVerbs } from "./partialWriteVerbs.ts";
import { ownTable, records, statementLog, uniqueTable } from "./writeTables.ts";

const partialWriteEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = uniqueTable("partial_profiles");
	yield* ownTable(
		sql,
		tableName,
		sql`id text primary key, name text not null, note text, owner text not null,
		details jsonb, "firstSeen" timestamptz not null, "updatedAt" timestamptz not null`,
	);
	const profiles = yield* makeRepository(Profile, {
		collection: collection(tableName, Schema.Number, { owner: Schema.String }),
		conflictColumns: ["id"],
		idColumn: "id",
		spanPrefix: "Profile",
		tableName,
	});
	const byOwner = yield* makeRepository(Profile, {
		collection: collection(tableName, Schema.String, { owner: Schema.String }),
		idColumn: ["id", "owner"],
		spanPrefix: "OwnedProfile",
		tableName,
	});
	return { byOwner, capture: yield* makeCapture<unknown>(), log: statementLog(), profiles, records: records(), sql, tableName };
});

export type PartialWriteEngine = Effect.Success<ReturnType<typeof partialWriteEngine>>;

export const partialWrites = storyKit({
	...onPostgres,
	create: partialWriteEngine,
	name: "PostgreSQL partial writes",
	stages: ["rows"],
	verbs: (engine, story) => partialWriteVerbs(engine, story.tell),
});

export function profileStored() {
	return partialWrites.trait("rows", "profile 1 belongs to alice with its original first-seen and update times", ({ profiles }) =>
		profiles.insertVoid(original),
	);
}
