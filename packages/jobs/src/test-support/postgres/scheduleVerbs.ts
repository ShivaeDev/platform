import { Effect, Schema } from "effect";
import type { ScheduleDefinition } from "#server/definition.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";
import { answer, testingOf } from "./verbs.ts";

export function scheduleVerbs(engine: DatabaseEngine, tell: (line: string) => void) {
	return {
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
