import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { UnsupportedEventVersion } from "#errors.ts";
import type { EventStoreOptions } from "#types.ts";

const Entry = Schema.Struct({
	eventVersion: Schema.Int,
	payload: Schema.Unknown,
	requestId: Schema.String,
	streamVersion: Schema.Int,
});

export const readEvents = Effect.fn("Events.readEvents")(function* <A, E, TUpcastError>(
	options: EventStoreOptions<A, E, TUpcastError>,
	stream: string,
	after = 0,
) {
	const sql = yield* SqlClient.SqlClient;
	const entries = yield* sql`select event_version as "eventVersion", payload, request_id as "requestId", stream_version as "streamVersion"
		from events_log where store = ${options.name} and stream = ${stream} and stream_version > ${after}
		order by stream_version`.withoutTransform.pipe(Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(Entry))));
	return yield* Effect.forEach(entries, (entry) =>
		Effect.gen(function* () {
			let payload = entry.payload;
			if (entry.eventVersion !== options.version) {
				if (options.upcast === undefined) {
					return yield* Effect.fail(new UnsupportedEventVersion({ currentVersion: options.version, storedVersion: entry.eventVersion }));
				}
				payload = yield* options.upcast({ payload: entry.payload, version: entry.eventVersion });
			}
			return {
				requestId: entry.requestId,
				stream,
				streamVersion: entry.streamVersion,
				value: yield* Schema.decodeUnknownEffect(Schema.toCodecJson(options.schema))(payload),
			};
		}),
	);
});
