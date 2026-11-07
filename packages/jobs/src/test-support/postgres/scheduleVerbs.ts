import { Effect, Option, Schema } from "effect";
import type { ScheduleDefinition } from "#server/definition.ts";
import type { DatabaseEngine } from "#test/postgres/databaseEngine.ts";
import { runningIn } from "#test/postgres/engine.ts";
import { answer, testingOf } from "#test/postgres/verbs.ts";

export function scheduleVerbs(engine: DatabaseEngine, tell: (line: string) => void) {
	return {
		runScheduleNow: (name: string, schedule: ScheduleDefinition, as: string) => {
			tell(`${name} runs ${schedule.name} now as ${as}`);
			return Effect.gen(function* () {
				const sent = yield* runningIn(engine, name).jobs.runScheduleNow(schedule);
				const id = Option.getOrThrow(sent);
				engine.labels.set(id, as);
				engine.jobs.set(as, { id, queue: { name: schedule.name, schema: Schema.Null } });
			});
		},
		triggerRun: (name: string, schedule: ScheduleDefinition, as: string) => {
			tell(`the testing controller of ${name} triggers ${schedule.name} as ${as}`);
			return answer(
				engine,
				Effect.suspend(() => testingOf(engine, name).trigger(schedule)).pipe(
					Effect.map((id) => {
						if (id === null) {
							return "nothing";
						}
						engine.labels.set(id, as);
						engine.jobs.set(as, { id, queue: { name: schedule.name, schema: Schema.Null } });
						return as;
					}),
				),
			);
		},
	};
}
