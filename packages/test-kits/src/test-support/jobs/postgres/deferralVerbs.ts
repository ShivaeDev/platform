import { DateTime, Effect } from "effect";
import type { QueueDefinition } from "@shivaedev/jobs/server/definition.ts";
import type { DatabaseEngine } from "#test/jobs/postgres/databaseEngine.ts";
import { testingOf } from "#test/jobs/postgres/verbs.ts";

export function deferralVerbs(engine: DatabaseEngine, tell: (line: string) => void) {
	return {
		deferrals: (name: string, queue: Pick<QueueDefinition, "name">) =>
			Effect.map(
				Effect.suspend(() => testingOf(engine, name).deferred(queue)),
				(waiting) =>
					waiting.map(({ at, reason }) => ({
						at: engine.work.deferrals.some((asked) => DateTime.toEpochMillis(asked.at) === DateTime.toEpochMillis(at))
							? "the time the worker asked for"
							: DateTime.formatIso(at),
						reason,
					})),
			),
		handlerCounts: (queue: Pick<QueueDefinition, "name">) =>
			Effect.sync(() =>
				engine.work.started.filter((attempt) => attempt.queue === queue.name).map(({ retryCount, deferralCount }) => ({ deferralCount, retryCount })),
			),
		runDueNow: (name: string, queue: Pick<QueueDefinition, "name">) => {
			tell(`the testing controller of ${name} makes waiting ${queue.name} jobs due now`);
			return Effect.suspend(() => testingOf(engine, name).runDueNow(queue));
		},
	};
}
