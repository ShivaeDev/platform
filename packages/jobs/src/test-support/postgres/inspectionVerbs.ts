import { DateTime, Effect } from "effect";
import type { QueueDefinition } from "#server/definition.ts";
import type { DatabaseEngine, StoryPayload } from "#test/postgres/databaseEngine.ts";
import { labelOf, runningIn } from "#test/postgres/engine.ts";

export function inspectionVerbs(engine: DatabaseEngine, tell: (line: string) => void) {
	return {
		inspectDeferrals: (name: string, queue: Pick<QueueDefinition, "name">) =>
			Effect.gen(function* () {
				const inspection = yield* runningIn(engine, name).jobs.inspection();
				const deferred = yield* inspection.deferred(queue);
				return deferred.map(({ at, reason }) => ({
					at: engine.work.deferrals.some((asked) => DateTime.toEpochMillis(asked.at) === DateTime.toEpochMillis(at))
						? "the requested time"
						: DateTime.formatIso(at),
					reason,
				}));
			}),
		inspectionChanged: (name: string) =>
			Effect.gen(function* () {
				const watch = engine.inspectionWatches.get(name);
				if (watch === undefined) {
					return yield* Effect.die(new Error(`${name} has no inspection watch`));
				}
				return (yield* watch.signal.revision) > watch.revision;
			}),
		inspectJobs: (name: string, queue: Pick<QueueDefinition<string, StoryPayload>, "name" | "schema">) =>
			Effect.gen(function* () {
				const inspection = yield* runningIn(engine, name).jobs.inspection();
				const jobs = yield* inspection.jobs(queue);
				return jobs.map((job) => ({
					data: job.data,
					expireInSeconds: job.expireInSeconds,
					job: labelOf(engine, job.id),
					retentionSeconds: (job.keepUntil.getTime() - job.startAfter.getTime()) / 1000,
					state: job.state,
				}));
			}),
		untilInspectionChanges: (name: string) => {
			tell(`${name} waits for the inspection signal`);
			return Effect.gen(function* () {
				const watch = engine.inspectionWatches.get(name);
				if (watch === undefined) {
					return yield* Effect.die(new Error(`${name} has no inspection watch`));
				}
				yield* watch.signal.waitForChange(watch.revision).pipe(Effect.timeout("20 seconds"));
			});
		},
		watchInspection: (name: string, queue?: Pick<QueueDefinition, "name">) => {
			tell(`${name} watches ${queue?.name ?? "all queues"} through inspection`);
			return Effect.gen(function* () {
				const inspection = yield* runningIn(engine, name).jobs.inspection();
				const signal = yield* inspection.changes(queue);
				engine.inspectionWatches.set(name, { revision: yield* signal.revision, signal });
			});
		},
	};
}
