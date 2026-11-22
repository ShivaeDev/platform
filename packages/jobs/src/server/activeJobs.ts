import { Duration, Effect, Option, Redacted, Schema } from "effect";
import { keysetPage } from "@shivaedev/sql/keysetPage.ts";
import { PgBossPayloadError } from "#server/error.ts";
import type { ActiveJob, JobPage, JobPageOptions } from "#server/health.ts";
import { ListingCursor, ListingPageOptions } from "#server/listingCursor.ts";
import { PgBossOperations } from "#server/services/operations/service.ts";

const Rows = Schema.Array(
	Schema.Struct({
		cursorAt: Schema.String,
		deadline: Schema.DateTimeUtcFromDate,
		id: Schema.String,
		queue: Schema.String,
		retryCount: Schema.Number,
		startedOn: Schema.DateTimeUtcFromDate,
		timeLeftMillis: Schema.Number,
	}),
);

export const activeJobs = Effect.fnUntraced(function* (queue: { readonly name: string }, options: JobPageOptions) {
	const operations = yield* PgBossOperations;
	const { cursor: after, limit } = yield* Schema.decodeUnknownEffect(ListingPageOptions)(options);
	const page = yield* keysetPage({
		after,
		cursorFor: (row: (typeof Rows.Type)[number]) => [row.cursorAt, row.id] as const,
		limit,
		orderBy: [{ column: "started_on", direction: "asc", value: (cursor) => cursor[0] }],
		read: (query) =>
			operations
				.listActiveJobs(queue.name, query)
				.pipe(
					Effect.flatMap((rows) =>
						Schema.decodeUnknownEffect(Rows)(rows).pipe(
							Effect.mapError((error) => new PgBossPayloadError({ direction: "decode", original: Redacted.make(error), queue: queue.name })),
						),
					),
				),
		tieBreaker: { column: "id", direction: "asc", value: (cursor) => cursor[1] },
	});
	const jobs = page.rows.map(
		({ deadline, id, queue: name, retryCount, startedOn, timeLeftMillis }): ActiveJob => ({
			attempt: retryCount + 1,
			deadline,
			id,
			queue: name,
			startedOn,
			timeLeft: Duration.millis(timeLeftMillis),
		}),
	);
	const listed: JobPage<ActiveJob> = { jobs, next: Option.map(page.next, Schema.encodeSync(ListingCursor)) };
	return listed;
});
