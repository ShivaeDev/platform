import { Clock, DateTime, Deferred, Effect, Fiber } from "effect";
import type { FindJobsOptions } from "pg-boss";
import type { QueueDefinition } from "#definition.ts";
import { failureOf } from "#test/failureOf.ts";
import type { DatabaseEngine, StoryPayload } from "./databaseEngine.ts";
import { labelOf, runningIn } from "./engine.ts";
import { testingOf } from "./verbs.ts";

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

function outcomeOf(fiber: Fiber.Fiber<unknown, unknown> | undefined, done: string) {
	if (fiber === undefined) {
		return "never started";
	}
	return fiber.pollUnsafe() === undefined ? "still waiting" : done;
}

export function controllerVerbs(engine: DatabaseEngine, tell: Tell) {
	return {
		changeWatch: (name: string) => Effect.sync(() => outcomeOf(engine.changeWatches.get(name), "woke for a later revision")),
		controllerJobs: <const TPayload extends StoryPayload>(name: string, queue: QueueDefinition<string, TPayload>, options?: FindJobsOptions) =>
			Effect.suspend(() => testingOf(engine, name).jobs(queue, options)).pipe(
				Effect.match({
					onFailure: failureOf,
					onSuccess: (jobs) => jobs.map(({ data, id, state }) => ({ data, job: labelOf(engine, id), state })),
				}),
			),
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
