import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { readEvents } from "#readEvents.ts";
import type { EventStoreOptions } from "#types.ts";

export const projectStream = Effect.fn("Events.projectStream")(function* <A, E, TUpcastError>(
	options: EventStoreOptions<A, E, TUpcastError>,
	stream: string,
) {
	const sql = yield* SqlClient.SqlClient;
	const checkpoints: { readonly projection: (typeof options.projections)[number]; readonly version: number }[] = [];
	for (const projection of options.projections) {
		yield* sql`insert into events_progress (store, projection, stream, version)
			values (${options.name}, ${projection.name}, ${stream}, 0) on conflict do nothing`;
		const progress = yield* sql`select version from events_progress
			where store = ${options.name} and projection = ${projection.name} and stream = ${stream} for update`.pipe(
			Effect.flatMap(Schema.decodeUnknownEffect(Schema.NonEmptyArray(Schema.Struct({ version: Schema.Int })))),
		);
		checkpoints.push({ projection, version: progress[0].version });
	}
	if (checkpoints.length === 0) {
		return;
	}
	const events = yield* readEvents(options, stream, Math.min(...checkpoints.map(({ version }) => version)));
	for (const event of events) {
		for (const { projection, version } of checkpoints) {
			if (event.streamVersion <= version) {
				continue;
			}
			yield* projection.apply(event);
			yield* sql`update events_progress set version = ${event.streamVersion}
				where store = ${options.name} and projection = ${projection.name} and stream = ${stream}`;
		}
	}
});
