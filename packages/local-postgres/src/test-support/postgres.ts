import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { connectCli, createPostgres } from "#test/postgresEngine.ts";
import { postgresVerbs, shown } from "#test/postgresVerbs.ts";

export const postgres = storyKit({
	after: { machine: connectCli },
	clock: "live",
	create: createPostgres,
	inspect: (engine) => ({ calls: engine.calls.map(shown), environment: engine.environment, outcome: engine.outcome }),
	name: "local postgres",
	stages: ["machine", "service"],
	verbs: postgresVerbs,
});
