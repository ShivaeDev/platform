import { type Context, Effect, Layer, Option, type Schema } from "effect";
import { BadRequest } from "@shivaedev/errors/taxonomy.ts";
import type { PgBossError, PgBossPayloadError } from "@shivaedev/jobs/server/error.ts";
import type { PgBossService } from "@shivaedev/jobs/server/service.ts";
import { type JobsEntry, type JobsPayload, jobsQueue } from "#jobs/entry.ts";
import { JobsNotFailed } from "#jobs/NotFailed.ts";
import { JobsPayloadInvalid, JobsQueueUnregistered, JobsUnavailable } from "#jobs/schemas.ts";
import { RegisteredQueues } from "#server/RegisteredQueues.ts";

type Declared<E> = E extends Schema.SchemaError
	? BadRequest
	: E extends PgBossPayloadError
		? JobsPayloadInvalid
		: E extends PgBossError
			? JobsUnavailable
			: never;

function jobsFailures<A, E extends PgBossError | PgBossPayloadError | Schema.SchemaError, R>(
	effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, Declared<E>, R>;
function jobsFailures<A, R>(
	effect: Effect.Effect<A, PgBossError | PgBossPayloadError | Schema.SchemaError, R>,
): Effect.Effect<A, BadRequest | JobsPayloadInvalid | JobsUnavailable, R> {
	return effect.pipe(
		Effect.mapError((error) => {
			switch (error._tag) {
				case "SchemaError":
					return new BadRequest({ message: "Invalid job page options" });
				case "PgBossPayloadError":
					return new JobsPayloadInvalid({ queue: error.queue });
				case "PgBossError":
					return new JobsUnavailable({ operation: error.operation });
			}
		}),
	);
}

// The Layer keeps the queue schemas' decoding services, so the page's operations require only RegisteredQueues.
export function pgBossQueues<const TQueues extends readonly JobsEntry[], TService>(
	service: Context.Service<TService, PgBossService>,
	...queues: TQueues
) {
	return Layer.effect(
		RegisteredQueues,
		Effect.gen(function* () {
			const runtime = yield* service;
			const inspection = yield* runtime.inspection();
			const decoding = yield* Effect.context<JobsPayload<TQueues[number]>["DecodingServices"]>();
			const entries: readonly TQueues[number][] = queues;
			function registered(name: string) {
				const entry = entries.find((candidate) => candidate.name === name);
				return entry === undefined ? Effect.fail(new JobsQueueUnregistered({ queue: name })) : Effect.succeed(jobsQueue(entry));
			}
			function decoded<A, E>(effect: Effect.Effect<A, E, JobsPayload<TQueues[number]>["DecodingServices"]>) {
				return Effect.provideContext(effect, decoding);
			}
			return RegisteredQueues.of({
				counts: (queue) => Effect.flatMap(registered(queue), (definition) => jobsFailures(inspection.counts(definition))),
				deadLetteredJobs: (queue, options) =>
					Effect.flatMap(registered(queue), (definition) =>
						decoded(jobsFailures(inspection.deadLetteredJobs<string, JobsPayload<TQueues[number]>>(definition, options))),
					),
				failedJobs: (queue, options) =>
					Effect.flatMap(registered(queue), (definition) =>
						decoded(jobsFailures(inspection.failedJobs<string, JobsPayload<TQueues[number]>>(definition, options))),
					),
				getJob: (queue, id) =>
					Effect.flatMap(registered(queue), (definition) =>
						decoded(jobsFailures(inspection.getJob<string, JobsPayload<TQueues[number]>>(definition, id))),
					),
				health: () => jobsFailures(inspection.health(queues)),
				retry: (queue, id) =>
					Effect.gen(function* () {
						const definition = yield* registered(queue);
						const job = yield* decoded(jobsFailures(inspection.getJob<string, JobsPayload<TQueues[number]>>(definition, id)));
						if (Option.isNone(job) || job.value.state !== "failed") {
							return yield* new JobsNotFailed({ id, queue });
						}
						yield* jobsFailures(runtime.retry(definition, id));
					}),
				runScheduleNow: (name) => {
					const schedule = entries.find((candidate) => candidate.name === name && !("schema" in candidate));
					if (schedule === undefined || "schema" in schedule) {
						return Effect.fail(new JobsQueueUnregistered({ queue: name }));
					}
					return runtime.runScheduleNow({ name: schedule.name, scheduleOptions: schedule.scheduleOptions ?? {} }).pipe(
						Effect.catchTag("PgBossNotFoundError", () => Effect.fail(new JobsQueueUnregistered({ queue: name }))),
						Effect.catchTag("PgBossError", (error) => Effect.fail(new JobsUnavailable({ operation: error.operation }))),
					);
				},
			});
		}),
	);
}
