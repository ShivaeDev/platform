import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { collection } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makeRepository } from "#repository.ts";
import { onPostgres } from "./engines.ts";

const schemas = {
	bigint: Schema.BigIntFromString,
	boolean: Schema.Boolean,
	date: Schema.Date,
	"mixed union": Schema.Union([Schema.String, Schema.Boolean]),
	object: Schema.Struct({ id: Schema.String }),
	unknown: Schema.Unknown,
};

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
		registration: () => Effect.sync(() => engine.result),
	}),
});
