import { Cause, Effect, Exit } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { postgresDefinition } from "#test/postgres.ts";
import { postgresVerbs } from "#test/postgresVerbs.ts";

export const scriptDefects = storyKit({
	...postgresDefinition,
	name: "script defects",
	verbs(engine, story) {
		const verbs = postgresVerbs(engine, story);
		let failure = "no defect";
		return {
			checkDocker: () =>
				Effect.map(Effect.exit(verbs.checkDocker()), (exit) => {
					failure = Exit.isFailure(exit) && Cause.hasDies(exit.cause) ? `defect: ${String(Cause.squash(exit.cause))}` : "no defect";
				}),
			failure: () => Effect.sync(() => failure),
		};
	},
});
