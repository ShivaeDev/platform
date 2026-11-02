import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { postgresDefinition } from "#test/postgres.ts";
import { postgresVerbs } from "#test/postgresVerbs.ts";

export const readiness = storyKit({
	...postgresDefinition,
	clock: "test",
	name: "PostgreSQL readiness delays",
	verbs: (engine, story) => {
		const verbs = postgresVerbs(engine, story);
		return {
			...verbs,
			beginStart: () => verbs.start().pipe(Effect.forkScoped, Effect.andThen(TestClock.adjust(0))),
			setupState: () => Effect.sync(() => engine.outcome ?? "waiting"),
			timePasses: (milliseconds: number) => {
				story.tell(`${milliseconds} ms pass`);
				return TestClock.adjust(milliseconds);
			},
		};
	},
});
