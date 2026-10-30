import { Effect, Option, Redacted, Schema } from "effect";
import type { PgBossClient } from "#client.ts";
import type { JobPayloadSchema } from "#definition.ts";
import { type PgBossError, PgBossPayloadError, toPgBossError } from "#error.ts";
import { type DeadLetteredJob, deadLetterQueueName, type JobPage, type JobPageOptions } from "#health.ts";
import { decodeStoredData, quotedSchema } from "#internal/storedRows.ts";
import { JobFailure } from "#JobFailure.ts";
import type { PgBossService } from "#service.ts";

const Cursor = Schema.StringFromBase64Url.pipe(
	Schema.decodeTo(
		Schema.fromJsonString(
			Schema.Tuple([
				Schema.String.check(Schema.makeFilter((value) => Option.isSome(Schema.decodeUnknownOption(Schema.DateTimeUtcFromString)(value)))),
				Schema.String.check(Schema.isUUID()),
			]),
		),
	),
);
const PageOptions = Schema.Struct({
	cursor: Schema.optionalKey(Schema.UndefinedOr(Cursor)),
	limit: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
});

const Row = Schema.Struct({
	completedOn: Schema.OptionFromNullOr(Schema.DateTimeUtcFromDate),
	createdOn: Schema.DateTimeUtcFromDate,
	cursorAt: Schema.String,
	data: Schema.Unknown,
	id: Schema.String,
	output: Schema.NullOr(JobFailure),
	queue: Schema.String,
	retryCount: Schema.Number,
	retryLimit: Schema.Number,
	sourceId: Schema.OptionFromNullOr(Schema.String),
	sourceOutput: Schema.NullOr(JobFailure),
	startedOn: Schema.OptionFromNullOr(Schema.DateTimeUtcFromDate),
	state: Schema.Literals(["created", "retry", "active", "completed", "cancelled", "failed"]),
});

const Rows = Schema.Array(Row);

type Listing = "deadLetteredJobs" | "failedJobs";

export function failedJobsFor(client: PgBossClient, schema: string): PgBossService["failedJobs"] {
	return (queue, options) =>
		listJobs(client, schema, "failedJobs", queue, options).pipe(
			Effect.map(({ jobs, next }) => ({ jobs: jobs.map(({ sourceId: _id, sourceOutput: _output, ...job }) => job), next })),
		);
}

export function deadLetteredJobsFor(client: PgBossClient, schema: string): PgBossService["deadLetteredJobs"] {
	return (queue, options) => listJobs(client, schema, "deadLetteredJobs", queue, options);
}

const listJobs = Effect.fnUntraced(function* <const TName extends string, const TPayload extends JobPayloadSchema | typeof Schema.Null>(
	client: PgBossClient,
	schema: string,
	listing: Listing,
	queue: { readonly name: TName; readonly schema: TPayload },
	options: JobPageOptions,
): Effect.fn.Return<JobPage<DeadLetteredJob<TPayload["Type"]>>, PgBossError | PgBossPayloadError | Schema.SchemaError, TPayload["DecodingServices"]> {
	const { cursor: after, limit } = yield* Schema.decodeUnknownEffect(PageOptions)(options);
	const rows = yield* Effect.tryPromise({
		catch: (error) => toPgBossError(listing, error, queue.name),
		try: async () => {
			if (client.getDb === undefined) {
				throw new TypeError("This pg-boss client does not support getDb");
			}
			const quoted = quotedSchema(schema);
			const { rows: storedRows } = await client.getDb().executeSql(
				`SELECT
					id,
					name AS queue,
					state,
					retry_count AS "retryCount",
					retry_limit AS "retryLimit",
					created_on AS "createdOn",
					started_on AS "startedOn",
					completed_on AS "completedOn",
					output,
					data,
					source_id AS "sourceId",
					source_output AS "sourceOutput",
					to_json(created_on) #>> '{}' AS "cursorAt"
				FROM ${quoted}.job
				WHERE name = $1
					${listing === "failedJobs" ? "AND state = 'failed'" : ""}
					AND ($2::timestamptz IS NULL OR (created_on, id) < ($2::timestamptz, $3::uuid))
				ORDER BY created_on DESC, id DESC
				LIMIT $4`,
				[listing === "failedJobs" ? queue.name : deadLetterQueueName(queue.name), after?.[0] ?? null, after?.[1] ?? null, limit + 1],
			);
			return storedRows;
		},
	});
	const decodedRows = yield* Schema.decodeUnknownEffect(Rows)(rows).pipe(
		Effect.mapError((error) => new PgBossPayloadError({ direction: "decode", original: Redacted.make(error), queue: queue.name })),
	);
	const page = decodedRows.slice(0, limit);
	const last = page.at(-1);
	const next = decodedRows.length > limit && last !== undefined ? Option.some(Schema.encodeSync(Cursor)([last.cursorAt, last.id])) : Option.none();
	return yield* Effect.forEach(page, ({ cursorAt: _, data, ...row }) =>
		decodeStoredData(queue, data).pipe(
			Effect.map((decoded) => ({ ...row, attempt: Option.isSome(row.startedOn) ? row.retryCount + 1 : 0, data: decoded })),
		),
	).pipe(Effect.map((jobs) => ({ jobs, next })));
});
