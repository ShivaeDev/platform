import { DateTime, Effect } from "effect";
import type { QueueDefinition } from "#definition.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";
import { idOf, testingOf } from "./verbs.ts";

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
		deferralsKept: (as: string) =>
			Effect.sync(() => {
				const { id } = idOf(engine, as);
				const attempts = engine.work.started.filter((attempt) => attempt.id === id);
				return engine.work.deferrals
					.filter((deferral) => deferral.id === id)
					.map((deferral, index) => {
						const next = attempts[index + 1];
						if (next === undefined) {
							return "has not run again";
						}
						const early = DateTime.toEpochMillis(deferral.at) - next.at;
						return early > 0 ? `ran again ${early} ms early` : "ran again at or after the deferral time";
					});
			}),
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
