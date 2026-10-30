import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeRepository } from "#repository.ts";

export class FeedRow extends Model.Class<FeedRow>("FeedRow")({
	id: Schema.Number,
	parent: Schema.NullOr(Schema.Number),
}) {}

class GeneratedRow extends Model.Class<GeneratedRow>("FeedGeneratedRow")({
	id: Model.Field({ json: Schema.Int, select: Schema.Int, update: Schema.Int }),
}) {}

class FeedDocument extends Model.Class<FeedDocument>("FeedDocument")({
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	lockVersion: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	name: Schema.String,
}) {}

class FeedReading extends Model.Class<FeedReading>("FeedReading")({
	amount: Schema.NumberFromString,
	sequence: Schema.NumberFromString,
	source: Schema.String,
}) {}

class FeedSource extends Model.Class<FeedSource>("FeedSource")({
	name: Schema.String,
	sourceKey: Schema.Int,
}) {}

class FeedCopy extends Model.Class<FeedCopy>("FeedCopy")({
	copiedKey: Schema.Int,
	id: Model.Field({ json: Schema.Int, select: Schema.Int, update: Schema.Int }),
	name: Schema.String,
}) {}

const ownedTable = Effect.fnUntraced(function* (alias: string, columns: string) {
	const sql = yield* SqlClient.SqlClient;
	const name = `feed_${alias}_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.acquireRelease(sql.unsafe(`create table "${name}" (${columns})`), () => Effect.orDie(sql.unsafe(`drop table "${name}"`)));
	return name;
});

export const rowsTable = Effect.gen(function* () {
	const name = yield* ownedTable("rows", "id integer primary key, parent integer");
	const sql = yield* SqlClient.SqlClient;
	yield* sql.unsafe(`alter table "${name}" add foreign key (parent) references "${name}" (id) deferrable initially deferred`);
	const repository = yield* makeRepository(FeedRow, { conflictColumns: ["id"], idColumn: "id", spanPrefix: "FeedRows", tableName: name });
	return { name, repository };
});

export const generatedTable = Effect.gen(function* () {
	const name = yield* ownedTable("generated", "id integer generated always as identity primary key");
	return { name, repository: yield* makeRepository(GeneratedRow, { idColumn: "id", spanPrefix: "FeedGenerated", tableName: name }) };
});

export const documentsTable = Effect.gen(function* () {
	const name = yield* ownedTable(
		"documents",
		`id integer generated always as identity primary key, name text not null, "lockVersion" integer not null`,
	);
	return {
		name,
		repository: yield* makeRepository(FeedDocument, { idColumn: "id", spanPrefix: "FeedDocuments", tableName: name, versionColumn: "lockVersion" }),
	};
});

export const readingsTable = Effect.gen(function* () {
	const name = yield* ownedTable("readings", "source text not null, sequence text not null, amount text not null, primary key (source, sequence)");
	return {
		name,
		repository: yield* makeRepository(FeedReading, {
			conflictColumns: ["source", "sequence"],
			idColumn: ["source", "sequence"],
			spanPrefix: "FeedReadings",
			tableName: name,
		}),
	};
});

export const copiesTables = Effect.gen(function* () {
	const sources = yield* ownedTable("sources", `"sourceKey" integer primary key, name text not null`);
	const name = yield* ownedTable(
		"copies",
		`id integer generated always as identity primary key, "copiedKey" integer not null unique, name text not null`,
	);
	return {
		copies: {
			name,
			repository: yield* makeRepository(FeedCopy, { conflictColumns: ["copiedKey"], idColumn: "id", spanPrefix: "FeedCopies", tableName: name }),
		},
		sources: {
			name: sources,
			repository: yield* makeRepository(FeedSource, { idColumn: "sourceKey", spanPrefix: "FeedSources", tableName: sources }),
		},
	};
});
