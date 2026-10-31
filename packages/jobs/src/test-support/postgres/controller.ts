import { Clock, DateTime, Deferred, Duration, Effect, Fiber } from "effect";
import type { FindJobsOptions, JobWithMetadata } from "pg-boss";
import type { QueueDefinition } from "#definition.ts";
import { failureOf } from "#test/failureOf.ts";
import type { DatabaseEngine, StoryPayload } from "./databaseEngine.ts";
import { labelOf, runningIn } from "./engine.ts";
import { idOf, testingOf } from "./verbs.ts";

type Tell = (line: string) => void;

export const watchChange = Effect.fnUntraced(function* (engine: DatabaseEngine, name: string, since: "now" | "the mark") {
	const testing = testingOf(engine, name);
	const from = since === "now" ? yield* testing.revision : (engine.revisionMarks.get(name) ?? (yield* testing.revision));
	engine.changeWatches.set(name, yield* Effect.forkScoped(testing.waitForChange(from)));
});

export function countIdleReads(engine: DatabaseEngine, name: string, gate: string) {
	return Effect.sync(() => {
		const db = runningIn(engine, name).client.getDb?.();
		if (db === undefined) {
			throw new TypeError("This pg-boss client exposes no database to observe");
		}
		const executeSql = db.executeSql.bind(db);
		db.executeSql = (text, values) => {
			if (text.includes("jobs testing idle")) {
				engine.idleReads.push(Deferred.isDoneUnsafe(engine.work.gate(gate).opened) ? "after the busy work went on" : "while work was busy");
			}
			return executeSql(text, values);
		};
	});
}

export function startIdleWait(engine: DatabaseEngine, name: string) {
	return Effect.map(
		Effect.forkScoped(
			Effect.suspend(() => testingOf(engine, name).waitForIdle),
			{ startImmediately: true },
		),
		(fiber) => {
			engine.idleWaits.set(name, fiber);
		},
	);
}

export function startFetchWatch(engine: DatabaseEngine, name: string, queue: Pick<QueueDefinition, "name">, count: number) {
	return Effect.map(
		Effect.forkScoped(
			Effect.suspend(() => testingOf(engine, name).fetchesPass(queue, count)),
			{ startImmediately: true },
		),
		(fiber) => {
			engine.fetchWatches.set(name, fiber);
		},
	);
}

function outcomeOf(fiber: Fiber.Fiber<unknown, unknown> | undefined, done: string) {
	if (fiber === undefined) {
		return "never started";
	}
	return fiber.pollUnsafe() === undefined ? "still waiting" : done;
}

export function controllerVerbs(engine: DatabaseEngine, tell: Tell) {
	return {
		changeWatch: (name: string) => Effect.sync(() => outcomeOf(engine.changeWatches.get(name), "woke for a later revision")),
		controllerAwaits: (name: string, as: string, state: JobWithMetadata["state"], within?: Duration.Input) => {
			tell(
				`the testing controller of ${name} waits until ${as} is ${state}${within === undefined ? "" : ` for at most ${Duration.format(Duration.fromInputUnsafe(within))}`}`,
			);
			return Effect.suspend(() => {
				const { id, queue } = idOf(engine, as);
				return testingOf(engine, name)
					.untilJob(queue, id, state, within === undefined ? {} : { within })
					.pipe(
						Effect.match({
							onFailure: (error) => ({ error: error.name, message: failureOf(error).replace(id, as) }),
							onSuccess: (job) => ({ data: job.data, job: labelOf(engine, job.id), state: job.state }),
						}),
					);
			});
		},
		controllerAwaitsFetches: (name: string, queue: Pick<QueueDefinition, "name">, count: number, within: Duration.Input) => {
			tell(`the testing controller of ${name} waits at most ${Duration.format(Duration.fromInputUnsafe(within))} for ${count} ${queue.name} fetches`);
			return Effect.suspend(() => testingOf(engine, name).fetchesPass(queue, count, { within })).pipe(
				Effect.match({ onFailure: (error) => ({ error: error.name, message: failureOf(error) }), onSuccess: () => "passed" }),
			);
		},
		controllerJobs: <const TPayload extends StoryPayload>(name: string, queue: QueueDefinition<string, TPayload>, options?: FindJobsOptions) =>
			Effect.suspend(() => testingOf(engine, name).jobs(queue, options)).pipe(
				Effect.match({
					onFailure: failureOf,
					onSuccess: (jobs) => jobs.map(({ data, id, state }) => ({ data, job: labelOf(engine, id), state })),
				}),
			),
		fetchWatch: (name: string) => Effect.sync(() => outcomeOf(engine.fetchWatches.get(name), "passed")),
		idleReads: () =>
			Effect.sync(() => {
				const busy = engine.idleReads.filter((read) => read === "while work was busy").length;
				return { "after the busy work went on": engine.idleReads.length - busy, "while work was busy": busy };
			}),
		idleWait: (name: string) => Effect.sync(() => outcomeOf(engine.idleWaits.get(name), "settled")),
		markRevision: (name: string) => {
			tell(`note the revision of the testing controller of ${name}`);
			return Effect.map(
				Effect.suspend(() => testingOf(engine, name).revision),
				(revision) => {
					engine.revisionMarks.set(name, revision);
				},
			);
		},
		revisionSinceMark: (name: string) =>
			Effect.map(
				Effect.suspend(() => testingOf(engine, name).revision),
				(revision) =>
					revision > (engine.revisionMarks.get(name) ?? Number.POSITIVE_INFINITY) ? "changed since the mark" : "unchanged since the mark",
			),
		snapshot: (name: string, queues: readonly Pick<QueueDefinition<string, StoryPayload>, "name" | "schema">[]) =>
			Effect.zip(
				Effect.suspend(() => testingOf(engine, name).snapshot(queues)),
				Clock.currentTimeMillis,
			).pipe(
				Effect.match({
					onFailure: failureOf,
					onSuccess: ([jobs, now]) =>
						jobs.map(({ data, id, queue, startAfter, state }) => ({
							data,
							job: labelOf(engine, id),
							queue,
							starts: DateTime.toEpochMillis(startAfter) > now ? "later" : "by now",
							state,
						})),
				}),
			),
		untilChanged: (name: string) => {
			tell(`wait until the testing controller of ${name} wakes for a change`);
			return Effect.suspend(() => {
				const fiber = engine.changeWatches.get(name);
				return fiber === undefined
					? Effect.die(new Error(`Nothing watches the testing controller of ${name}`))
					: Fiber.join(fiber).pipe(Effect.timeout("20 seconds"));
			});
		},
		untilFetchWatchPasses: (name: string) => {
			tell(`wait until the fetch watch of ${name} passes`);
			return Effect.suspend(() => {
				const fiber = engine.fetchWatches.get(name);
				return fiber === undefined ? Effect.die(new Error(`${name} started no fetch watch`)) : Fiber.join(fiber).pipe(Effect.timeout("20 seconds"));
			});
		},
		untilIdleWaitSettles: (name: string) => {
			tell(`wait until the idle wait of ${name} settles`);
			return Effect.suspend(() => {
				const fiber = engine.idleWaits.get(name);
				return fiber === undefined ? Effect.die(new Error(`${name} started no idle wait`)) : Fiber.join(fiber).pipe(Effect.timeout("20 seconds"));
			});
		},
		watchForChange: (name: string, since: "now" | "the mark" = "now") => {
			tell(`the testing controller of ${name} starts waiting for a change since ${since}`);
			return watchChange(engine, name, since);
		},
	};
}
