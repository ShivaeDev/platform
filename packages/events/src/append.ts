import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { transact } from "@shivaedev/sql/transact.ts";
import { AlreadyDone, StreamConflict } from "#errors.ts";
import { projectStream } from "#projectStream.ts";
import type { Append, EventStoreOptions } from "#types.ts";

const Version = Schema.Struct({ version: Schema.Int });

export const append = Effect.fn("Events.append")(function* <A, E, TUpcastError>(options: EventStoreOptions<A, E, TUpcastError>, command: Append<A>) {
	return yield* transact(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const version = command.expectedVersion + command.events.length;
			const claimed = yield* sql`insert into events_requests (store, request_id, stream, version)
				values (${options.name}, ${command.requestId}, ${command.stream}, ${version})
				on conflict do nothing returning request_id`;
			if (claimed.length === 0) {
				const [done] = yield* sql`select stream, version from events_requests
					where store = ${options.name} and request_id = ${command.requestId}`.pipe(
					Effect.flatMap(Schema.decodeUnknownEffect(Schema.NonEmptyArray(Schema.Struct({ stream: Schema.String, version: Schema.Int })))),
				);
				return yield* Effect.fail(new AlreadyDone({ requestId: command.requestId, stream: done.stream, streamVersion: done.version }));
			}
			yield* sql`insert into events_streams (store, stream, version) values (${options.name}, ${command.stream}, 0) on conflict do nothing`;
			const changed = yield* sql`update events_streams set version = ${version}
				where store = ${options.name} and stream = ${command.stream} and version = ${command.expectedVersion} returning version`;
			if (changed.length === 0) {
				const [current] = yield* sql`select version from events_streams where store = ${options.name} and stream = ${command.stream}`.pipe(
					Effect.flatMap(Schema.decodeUnknownEffect(Schema.NonEmptyArray(Version))),
				);
				return yield* Effect.fail(
					new StreamConflict({ actualVersion: current.version, expectedVersion: command.expectedVersion, stream: command.stream }),
				);
			}
			for (const [index, event] of command.events.entries()) {
				const payload = yield* Schema.encodeEffect(Schema.toCodecJson(options.schema))(event);
				yield* sql`insert into events_log (store, stream, stream_version, request_id, event_version, payload)
					values (${options.name}, ${command.stream}, ${command.expectedVersion + index + 1}, ${command.requestId}, ${options.version}, ${JSON.stringify(payload)}::jsonb)`;
			}
			if (command.events.length > 0) {
				yield* projectStream(options, command.stream);
			}
			return version;
		}),
		{ onSqlError: (error) => error },
	);
});
