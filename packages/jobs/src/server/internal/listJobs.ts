import { Effect, Option, Schema } from "effect";
import type { PgBossClient } from "#client.ts";
import type { JobPayloadSchema, QueueDefinition } from "#definition.ts";
import { type PgBossError, type PgBossPayloadError, toPgBossError } from "#error.ts";
import { type DeadLetteredJob, deadLetterQueueName, type JobPage, type JobPageOptions } from "#health.ts";
import { decodeStoredData, quotedSchema } from "#internal/storedRows.ts";
import type { PgBossService } from "#service.ts";

const Cursor = Schema.StringFromBase64Url.pipe(Schema.decodeTo(Schema.fromJsonString(Schema.Tuple([Schema.String, Schema.String]))));

const Row = Schema.Struct({
	completedOn: Schema.OptionFromNullOr(Schema.DateTimeUtcFromDate),
	createdOn: Schema.DateTimeUtcFromDate,
	cursorAt: Schema.String,
	data: Schema.Unknown,
	id: Schema.String,
	output: Schema.Unknown,
	queue: Schema.String,
	retryCount: Schema.Number,
	retryLimit: Schema.Number,
	sourceId: Schema.OptionFromNullOr(Schema.String),
	sourceOutput: Schema.Unknown,
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

function listJobs<const TName extends string, const TPayload extends JobPayloadSchema>(
	client: PgBossClient,
	schema: string,
	listing: Listing,
	queue: Pick<QueueDefinition<TName, TPayload>, "name" | "schema">,
	options: JobPageOptions,
): Effect.Effect<JobPage<DeadLetteredJob<TPayload["Type"]>>, PgBossError | PgBossPayloadError, TPayload["DecodingServices"]> {
	return Effect.tryPromise({
		catch: (error) => toPgBossError(listing, error, queue.name),
		try: async () => {
			if (client.getDb === undefined) {
				throw new TypeError("This pg-boss client does not support getDb");
			}
			if (!Number.isSafeInteger(options.limit) || options.limit < 1) {
				throw new RangeError("The page limit must be a positive integer");
			}
			const after = options.cursor === undefined ? undefined : await Schema.decodeUnknownPromise(Cursor)(options.cursor);
			const quoted = quotedSchema(schema);
			const { rows } = await client.getDb().executeSql(
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
				[listing === "failedJobs" ? queue.name : deadLetterQueueName(queue.name), after?.[0] ?? null, after?.[1] ?? null, options.limit + 1],
			);
			return Schema.decodeUnknownPromise(Rows)(rows);
		},
	}).pipe(
		Effect.flatMap((rows) => {
			const page = rows.slice(0, options.limit);
			const last = page.at(-1);
			const next =
				rows.length > options.limit && last !== undefined ? Option.some(Schema.encodeSync(Cursor)([last.cursorAt, last.id])) : Option.none();
			return Effect.forEach(page, ({ cursorAt: _, data, ...row }) =>
				decodeStoredData(queue, data).pipe(
					Effect.map((decoded) => ({ ...row, attempt: Option.isSome(row.startedOn) ? row.retryCount + 1 : 0, data: decoded })),
				),
			).pipe(Effect.map((jobs) => ({ jobs, next })));
		}),
	);
}
