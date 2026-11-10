import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { transact } from "@shivaedev/sql/transact.ts";
import { append } from "#append.ts";
import { projectStream } from "#projectStream.ts";
import { readEvents } from "#readEvents.ts";
import type { Append, EventStoreOptions } from "#types.ts";

const streams = Effect.fn("Events.streams")(function* (name: string) {
	const sql = yield* SqlClient.SqlClient;
	return yield* sql`select stream from events_streams where store = ${name} order by stream`.pipe(
		Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(Schema.Struct({ stream: Schema.String })))),
	);
});

export const makeEventStore = Effect.fn("Events.makeEventStore")(function* <A, E = never, TUpcastError = never>(
	options: EventStoreOptions<A, E, TUpcastError>,
) {
	const sql = yield* SqlClient.SqlClient;
	const catchUp = Effect.gen(function* () {
		for (const { stream } of yield* streams(options.name)) {
			yield* transact(
				Effect.gen(function* () {
					yield* sql`select version from events_streams where store = ${options.name} and stream = ${stream} for update`;
					yield* projectStream(options, stream);
				}),
			);
		}
	});
	const rebuild = transact(
		Effect.gen(function* () {
			yield* sql`lock table events_streams in exclusive mode`;
			for (const projection of options.projections) {
				yield* projection.reset;
				yield* sql`delete from events_progress where store = ${options.name} and projection = ${projection.name}`;
			}
			for (const { stream } of yield* streams(options.name)) {
				yield* projectStream(options, stream);
			}
		}),
	);
	return {
		append: (command: Append<A>) => append(options, command),
		catchUp,
		read: (stream: string) => readEvents(options, stream),
		rebuild,
	};
});
