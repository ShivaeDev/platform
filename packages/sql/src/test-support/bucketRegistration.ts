import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makeRepository } from "#repository.ts";
import { onPostgres } from "#test/engines.ts";

const schemas = {
	bigint: Schema.BigIntFromString,
	boolean: Schema.Boolean,
	date: Schema.Date,
	"mixed union": Schema.Union([Schema.String, Schema.Boolean]),
	object: Schema.Struct({ id: Schema.String }),
	unknown: Schema.Unknown,
};

const declarations = {
	"a collection named bucketRegistration": collection("bucketRegistration", Schema.Number, { ownerId: Schema.String }),
	"a collection named bucketRegistration with a title bucket": collection("bucketRegistration", Schema.Number, { title: Schema.String }),
	"a collection with a title bucket": collection("bucket_registration", Schema.Number, { title: Schema.String }),
	"no collection": undefined,
};

export type Declared = keyof typeof declarations;

class VersionRow extends Model.Class<VersionRow>("BucketVersionRow")({
	id: Schema.Number,
	ownerBucket: bucket(Schema.String),
}) {}

class PlainRow extends Model.Class<PlainRow>("BucketVersionPlainRow")({
	day: Schema.NullOr(Schema.Number),
	id: Schema.Number,
	owner: Schema.String,
}) {}

const versionRepositories = {
	"a single-column bucket": () =>
		Effect.asVoid(
			makeRepository(VersionRow, {
				collection: collection("bucket_version", Schema.Number, { ownerBucket: Schema.String }),
				idColumn: "id",
				spanPrefix: "BucketVersion",
				tableName: "bucket_version",
			}),
		),
	"a tuple bucket": () =>
		Effect.asVoid(
			makeRepository(PlainRow, {
				collection: collection("bucket_version", Schema.Number, {}, { ownerDay: ["owner", "day"] }),
				idColumn: "id",
				spanPrefix: "BucketVersion",
				tableName: "bucket_version",
			}),
		),
	"no buckets": () => Effect.asVoid(makeRepository(PlainRow, { idColumn: "id", spanPrefix: "BucketVersion", tableName: "bucket_version" })),
};

interface ReportedServer {
	readonly number: string;
	readonly version: string;
}

// The session's search_path puts a current_setting that reports an older server ahead of pg_catalog; the transaction drops it again.
const reportingServer = Effect.fnUntraced(function* <A, E, R>(reported: ReportedServer, effect: Effect.Effect<A, E, R>) {
	const sql = yield* SqlClient.SqlClient;
	return yield* sql.withTransaction(
		Effect.gen(function* () {
			yield* sql`create schema reported_server`;
			yield* sql.unsafe(`create function reported_server.current_setting(name text) returns text language sql as $$
				select case name when 'server_version_num' then '${reported.number}' when 'server_version' then '${reported.version}'
				else pg_catalog.current_setting(name) end $$`);
			yield* sql`set local search_path = reported_server, pg_catalog, public`;
			const result = yield* effect;
			yield* sql`drop schema reported_server cascade`;
			return result;
		}),
	);
});

export const bucketRegistration = storyKit({
	...onPostgres,
	create: () => Effect.succeed<{ reported?: ReportedServer; result: string }>({ result: "not registered" }),
	name: "PostgreSQL bucket registration",
	stages: ["server"],
	verbs: (engine, story) => ({
		register: (kind: keyof typeof schemas) =>
			Effect.gen(function* () {
				story.tell(`a repository registers ${kind} bucket values through a schema annotation`);
				class Row extends Model.Class<Row>("BucketRegistrationRow")({
					id: Schema.Number,
					value: schemas[kind].annotate({ "@shivaedev/changes/bucket": true }),
				}) {}
				engine.result = yield* makeRepository(Row, {
					collection: collection("bucket_registration", Schema.Number, { value: Schema.String }),
					idColumn: "id",
					spanPrefix: "BucketRegistration",
					tableName: "bucket_registration",
				}).pipe(
					Effect.match({
						onFailure: (error) => `${error._tag}: ${error.message}`,
						onSuccess: () => "registered",
					}),
				);
			}),
		registerCollection: (declared: Declared) =>
			Effect.gen(function* () {
				story.tell(`a repository on table bucket_registration with an ownerId bucket declares ${declared}`);
				class Row extends Model.Class<Row>("BucketRegistrationCollectionRow")({
					id: Schema.Number,
					ownerId: bucket(Schema.String),
				}) {}
				const declaration = declarations[declared];
				engine.result = yield* makeRepository(Row, {
					...(declaration === undefined ? {} : { collection: declaration }),
					idColumn: "id",
					spanPrefix: "BucketRegistration",
					tableName: "bucket_registration",
				}).pipe(
					Effect.match({
						onFailure: (error) => `${error._tag}: ${error.message}`,
						onSuccess: () => "registered",
					}),
				);
			}),
		registerTuple: (column: "missing" | "flag") =>
			Effect.gen(function* () {
				story.tell(`a repository declares an owner-and-${column} tuple bucket over a model with a boolean flag and no missing field`);
				class Row extends Model.Class<Row>("BucketRegistrationTupleRow")({
					flag: Schema.Boolean,
					id: Schema.Number,
					owner: Schema.String,
				}) {}
				engine.result = yield* makeRepository(Row, {
					collection: collection("bucket_registration", Schema.Number, {}, { ownerTuple: ["owner", column] }),
					idColumn: "id",
					spanPrefix: "BucketRegistration",
					tableName: "bucket_registration",
				}).pipe(
					Effect.match({
						onFailure: (error) => `${error._tag}: ${error.message}`,
						onSuccess: () => "registered",
					}),
				);
			}),
		registerWith: (buckets: keyof typeof versionRepositories) =>
			Effect.gen(function* () {
				story.tell(`a repository with ${buckets} registers`);
				const registered = versionRepositories[buckets]().pipe(
					Effect.match({
						onFailure: (error) => `${error._tag}: ${error.message}`,
						onSuccess: () => "registered",
					}),
				);
				engine.result = yield* engine.reported === undefined ? registered : reportingServer(engine.reported, registered);
			}),
		registration: () => Effect.sync(() => engine.result),
	}),
});

export function serverReports(version: string, number: string) {
	return bucketRegistration.trait(
		"server",
		`the database session reports PostgreSQL ${version} (a shadowed current_setting; the test server runs PostgreSQL 18)`,
		(engine) =>
			Effect.sync(() => {
				engine.reported = { number, version };
			}),
	);
}
