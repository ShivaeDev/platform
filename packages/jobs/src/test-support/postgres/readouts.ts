import { Effect, Option } from "effect";
import type { JobWithMetadata } from "pg-boss";
import type { QueueDefinition } from "#definition.ts";
import { spanTree } from "#test/spanTree.ts";
import type { DatabaseEngine, StoryPayload } from "./databaseEngine.ts";
import { admin, anyRuntime, errorOf, labelOf, runningIn } from "./engine.ts";
import { deadLetterSources, idOf, lookup } from "./verbs.ts";

function summary(engine: DatabaseEngine, job: JobWithMetadata<unknown>) {
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

function relabelled(engine: DatabaseEngine, value: unknown): unknown {
	return typeof value === "string" ? labelOf(engine, value) : value;
}

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
		drained: (runtime: string, queue: Pick<QueueDefinition, "name" | "workerOptions">) =>
			Effect.sync(() => {
				const ids = new Set(engine.work.attemptsOf(queue.name));
				const last = Math.max(...engine.work.finished.filter(({ id }) => ids.has(id)).map(({ at }) => at));
				const seconds = (last - runningIn(engine, runtime).startedAt) / 1000;
				const poll = queue.workerOptions.pollingIntervalSeconds ?? 2;
				return seconds < poll ? "before the worker's next poll" : `${seconds} seconds after startup, past the ${poll} second poll`;
			}),
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
		logged: (runtime?: string) =>
			Effect.sync(() =>
				engine.logs.filter((entry) => runtime === undefined || entry.runtime === runtime).map(({ level, message }) => ({ level, message })),
			),
		mostRunningAtOnce: (queue: Pick<QueueDefinition, "name">) => Effect.sync(() => engine.work.peaks.get(queue.name) ?? 0),
		overlappingAttempts: () => Effect.sync(() => engine.work.overlaps.map((id) => labelOf(engine, id))),
		reported: () => Effect.sync(() => [...engine.reported]),
		secondsUntilFirstAttempt: (as: string) =>
			Effect.sync(() => {
				const { id } = idOf(engine, as);
				const first = engine.work.started.find((attempt) => attempt.id === id);
				const enqueuedAt = engine.enqueuedAt.get(as);
				return first === undefined || enqueuedAt === undefined ? "never started" : (first.at - enqueuedAt) / 1000;
			}),
		seenBeforeCommit: () => Effect.sync(() => engine.seenBeforeCommit),
		spans: () =>
			Effect.sync(() =>
				spanTree(engine.trace.spans).map((span) => ({
					...span,
					attributes: Object.fromEntries(Object.entries(span.attributes).map(([key, value]) => [key, relabelled(engine, value)])),
				})),
			),
		storedJobs: (queue: string) =>
			Effect.gen(function* () {
				const client = yield* admin(engine);
				return (yield* Effect.promise(() => client.findJobs(queue))).map((job) => summary(engine, job));
			}),
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
		storedQueue: (name: string) =>
			Effect.gen(function* () {
				const client = yield* admin(engine);
				return (yield* Effect.promise(() => client.getQueue(name))) ?? "missing";
			}),
		storedSchedules: (name: string) =>
			Effect.gen(function* () {
				const client = yield* admin(engine);
				return (yield* Effect.promise(() => client.getSchedules(name))).map(({ cron, name: scheduled, options, timezone }) => ({
					cron,
					name: scheduled,
					options,
					timezone,
				}));
			}),
		storedStateCounts: (queue: string) =>
			Effect.gen(function* () {
				const client = yield* admin(engine);
				const counts: Record<string, number> = {};
				for (const { state } of yield* Effect.promise(() => client.findJobs(queue))) {
					counts[state] = (counts[state] ?? 0) + 1;
				}
				return counts;
			}),
		storedStates: (queue: string) =>
			Effect.gen(function* () {
				const client = yield* admin(engine);
				const stored = yield* Effect.promise(() => client.findJobs(queue));
				const states: Record<string, string> = Object.fromEntries(stored.map((job) => [labelOf(engine, job.id), job.state]));
				return states;
			}),
		timeline: (runtime: string) =>
			Effect.sync(() => {
				const queues = runningIn(engine, runtime).queues;
				const finishedHere = new Set(
					engine.work.finished
						.filter(({ id }) => engine.work.started.some((attempt) => attempt.id === id && queues.includes(attempt.queue)))
						.map(({ id }) => `${labelOf(engine, id)} finished`),
				);
				return engine.timeline.filter((line) => line.startsWith(`${runtime}: `) || finishedHere.has(line));
			}),
		wakes: (runtime: string) => Effect.sync(() => [...(engine.wakes.get(runtime) ?? [])].sort((left, right) => left.localeCompare(right))),
		workingQueues: (runtime: string) =>
			Effect.sync(() =>
				[...new Set((runningIn(engine, runtime).client.getWipData?.() ?? []).map((worker) => worker.name))].sort((left, right) =>
					left.localeCompare(right),
				),
			),
	};
}
