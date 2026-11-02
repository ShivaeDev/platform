import * as NodeServices from "@effect/platform-node/NodeServices";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { connectCli, createPostgres, type PostgresEngine } from "#test/postgresEngine.ts";
import { postgresVerbs, shown } from "#test/postgresVerbs.ts";

export const postgresDefinition = {
	after: { machine: connectCli },
	clock: "live" as const,
	create: () => createPostgres,
	inspect: (engine: PostgresEngine) => ({ calls: engine.calls.map(shown), environment: engine.environment, outcome: engine.outcome }),
	layer: NodeServices.layer,
	name: "local postgres",
	stages: ["machine", "service"] as const,
	verbs: postgresVerbs,
};

export const postgres = storyKit(postgresDefinition);
