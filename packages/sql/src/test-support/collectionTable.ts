import { Effect, Layer, Order, Schema, Tracer } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { makeCapture } from "@shivaedev/changes/capture.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makeRepository } from "#repository.ts";
import { onPostgres } from "#test/engines.ts";
import { ownTable, uniqueTable } from "#test/writeTables.ts";
import { ChangeObserver } from "#transact.ts";

class Bookmark extends Model.Class<Bookmark>("Bookmark")({
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	url: Schema.String,
	userId: bucket(Schema.String),
}) {}

const collectionTableEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = uniqueTable("bookmarks");
	yield* ownTable(sql, tableName, sql`id integer generated always as identity primary key, "userId" text not null, url text not null`);
	const keys = collection(tableName, Schema.Number, { userId: Schema.String });
	const spans: string[] = [];
	const tracer = Tracer.make({
		span: (options) => {
			spans.push(options.name);
			return new Tracer.NativeSpan(options);
		},
	});
	const capture = yield* makeCapture<unknown>();
	return {
		bookmarks: yield* makeRepository(Bookmark, { collection: keys }),
		capture,
		ids: new Map<string, number>(),
		observed: Layer.merge(capture.layer(ChangeObserver), Layer.succeed(Tracer.Tracer, tracer)),
		spans,
		sql,
		tableName,
	};
});

export const collectionTable = storyKit({
	...onPostgres,
	create: collectionTableEngine,
	name: "PostgreSQL repository named by its collection",
	stages: [],
	verbs: (engine, story) => {
		function named(value: string) {
			return value.replaceAll(engine.tableName, "bookmarks");
		}
		return {
			announcedKeys: () =>
				Effect.map(engine.capture.attempted, (batches) => [...new Set(batches.flat().map((key) => named(String(key))))].toSorted(Order.String)),
			found: (url: string) => {
				story.tell(`the repository reads the bookmark for ${url} by its id`);
				return Effect.map(engine.bookmarks.findById(engine.ids.get(url) ?? -1), (bookmark) => ({ url: bookmark.url, userId: bookmark.userId })).pipe(
					Effect.provide(engine.observed),
				);
			},
			repositorySpans: () => Effect.sync(() => engine.spans.filter((name) => name.startsWith(`${engine.tableName}.`)).map(named)),
			save: (userId: string, url: string) => {
				story.tell(`the repository built from only the bookmarks collection saves ${url} for ${userId}`);
				return engine.bookmarks.insert({ url, userId }).pipe(
					Effect.tap(({ id }) => Effect.sync(() => engine.ids.set(url, id))),
					Effect.provide(engine.observed),
				);
			},
			storedRows: () =>
				Effect.map(
					engine.sql<{ readonly url: string; readonly userId: string }>`select "userId", url from ${engine.sql(engine.tableName)} order by id`,
					(rows) => rows.map(({ url, userId }) => ({ url, userId })),
				),
		};
	},
});
