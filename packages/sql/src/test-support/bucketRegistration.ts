import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
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

export const bucketRegistration = storyKit({
	...onPostgres,
	create: () => Effect.succeed({ result: "not registered" }),
	name: "PostgreSQL bucket registration",
	stages: [],
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
		registration: () => Effect.sync(() => engine.result),
	}),
});
