import { Effect, Option } from "effect";
import type { QueueDefinition } from "@shivaedev/jobs/server/definition.ts";
import type { Job } from "@shivaedev/jobs/server/job.ts";
import type { DatabaseEngine, StoryPayload } from "#test/jobs/postgres/databaseEngine.ts";
import { admin, anyRuntime, errorOf, labelOf } from "#test/jobs/postgres/engine.ts";
import { deadLetterSources, lookup } from "#test/jobs/postgres/verbs.ts";

export function readouts(engine: DatabaseEngine) {
	return {
		attemptCounts: (queue: Pick<QueueDefinition, "name">) =>
			Effect.sync(() => {
				const counts: Record<string, number> = {};
				for (const id of engine.work.attemptsOf(queue.name)) {
					const label = labelOf(engine, id);
					counts[label] = (counts[label] ?? 0) + 1;
				}
				return counts;
			}),
		attempts: (queue: Pick<QueueDefinition, "name">) => Effect.sync(() => engine.work.attemptsOf(queue.name).map((id) => labelOf(engine, id))),
		deadLettered: (queue: Pick<QueueDefinition, "name">) => deadLetterSources(engine, queue.name),
		handled: (queue: Pick<QueueDefinition, "name">) => Effect.sync(() => engine.work.handled(queue.name)),
		interruptions: (queue: Pick<QueueDefinition, "name">) =>
			Effect.sync(() =>
				engine.work.interrupted.flatMap(({ at, id }) => {
					const attempt = engine.work.started.findLast((started) => started.id === id && started.queue === queue.name);
					return attempt === undefined
						? []
						: [`${labelOf(engine, id)} ${at >= attempt.deadline ? "at or after its deadline" : "before its deadline"}`];
				}),
			),
		job: (as: string) => Effect.map(lookup(engine, as), (job) => (Option.isSome(job) ? summary(engine, job.value) : "missing")),
		storedPayloads: <const TPayload extends StoryPayload>(queue: QueueDefinition<string, TPayload>) =>
			Effect.gen(function* () {
				const client = yield* admin(engine);
				const stored = yield* Effect.promise(() => client.findJobs(queue.name));
				const jobs = anyRuntime(engine).jobs;
				return yield* Effect.forEach(stored, (job) =>
					Effect.map(
						jobs.getJob(queue, job.id),
						Option.map(({ data }) => data),
					),
				);
			}),
		storedStates: (queue: string) =>
			Effect.gen(function* () {
				const client = yield* admin(engine);
				const stored = yield* Effect.promise(() => client.findJobs(queue));
				const states: Record<string, string> = Object.fromEntries(stored.map((job) => [labelOf(engine, job.id), job.state]));
				return states;
			}),
	};
}

function summary(engine: DatabaseEngine, job: Job<unknown>) {
	return {
		data: job.data,
		error: errorOf(job.output),
		expireInSeconds: job.expireInSeconds,
		job: labelOf(engine, job.id),
		retryBackoff: job.retryBackoff,
		retryCount: job.retryCount,
		retryDelay: job.retryDelay,
		retryLimit: job.retryLimit,
		singletonKey: job.singletonKey,
		startAfter: job.startAfter,
		state: job.state,
	};
}
