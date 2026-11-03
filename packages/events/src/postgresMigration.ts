import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export const postgresMigration = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create table events_streams (
		store text not null, stream text not null, version integer not null,
		primary key (store, stream)
	)`;
	yield* sql`create table events_requests (
		store text not null, request_id text not null, stream text not null, version integer not null,
		primary key (store, request_id)
	)`;
	yield* sql`create table events_log (
		store text not null, stream text not null, stream_version integer not null,
		request_id text not null, event_version integer not null, payload jsonb not null,
		primary key (store, stream, stream_version),
		foreign key (store, stream) references events_streams (store, stream)
	)`;
	yield* sql`create table events_progress (
		store text not null, projection text not null, stream text not null, version integer not null,
		primary key (store, projection, stream),
		foreign key (store, stream) references events_streams (store, stream)
	)`;
});
