import { type Context, Effect, Option, Redacted, Schema } from "effect";
import { redact } from "@shivaedev/errors/redact.ts";
import { JobFailure } from "#JobFailure.ts";
import type { JobPayloadSchema } from "#server/definition.ts";
import { type PgBossError, PgBossPayloadError } from "#server/error.ts";
import type { DeadLetteredJob, JobPage, JobPageOptions } from "#server/health.ts";
import { JobEngine, type Listing } from "#server/internal/engine.ts";
import { decodeStoredData } from "#server/internal/storedRows.ts";
import type { PgBossService } from "#server/service.ts";

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

export const jobListings = Effect.gen(function* () {
	const engine = yield* JobEngine;
	const failedJobs: PgBossService["failedJobs"] = (queue, options) =>
		listJobs(engine, "failedJobs", queue, options).pipe(
			Effect.map(({ jobs, next }) => ({ jobs: jobs.map(({ sourceId: _id, sourceOutput: _output, ...job }) => job), next })),
		);
	const deadLetteredJobs: PgBossService["deadLetteredJobs"] = (queue, options) =>
		listJobs(engine, "deadLetteredJobs", queue, options).pipe(
			Effect.map(({ jobs, next }) => ({ jobs: jobs.map((job) => ({ ...job, sourceQueue: queue.name })), next })),
		);
	return { deadLetteredJobs, failedJobs };
});

const listJobs = Effect.fnUntraced(function* <const TName extends string, const TPayload extends JobPayloadSchema | typeof Schema.Null>(
	engine: Context.Service.Shape<typeof JobEngine>,
	listing: Listing,
	queue: { readonly name: TName; readonly schema: TPayload },
	options: JobPageOptions,
): Effect.fn.Return<
	JobPage<Omit<DeadLetteredJob<unknown>, "sourceQueue">>,
	PgBossError | PgBossPayloadError | Schema.SchemaError,
	TPayload["DecodingServices"]
> {
	const { cursor: after, limit } = yield* Schema.decodeUnknownEffect(PageOptions)(options);
	const rows = yield* engine.listJobs(listing, queue.name, after, limit);
	const decodedRows = yield* Schema.decodeUnknownEffect(Rows)(rows).pipe(
		Effect.mapError((error) => new PgBossPayloadError({ direction: "decode", original: Redacted.make(error), queue: queue.name })),
	);
	const page = decodedRows.slice(0, limit);
	const last = page.at(-1);
	const next = decodedRows.length > limit && last !== undefined ? Option.some(Schema.encodeSync(Cursor)([last.cursorAt, last.id])) : Option.none();
	return yield* Effect.forEach(page, ({ cursorAt: _, data, ...row }) =>
		decodeStoredData(queue, data).pipe(
			Effect.map((decoded) => ({ ...row, attempt: Option.isSome(row.startedOn) ? row.retryCount + 1 : 0, data: redact(decoded) })),
		),
	).pipe(Effect.map((jobs) => ({ jobs, next })));
});
