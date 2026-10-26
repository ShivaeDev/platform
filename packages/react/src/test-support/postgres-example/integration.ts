import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { isolate } from "#test/order-example/isolation.ts";
import { hasPostgres, workerDatabase } from "#test/order-example/postgres.ts";
import { createLiveEngine } from "./liveEngine.ts";
import { liveVerbs } from "./liveVerbs.ts";

export const integration = storyKit({
	around: isolate,
	clock: "live",
	create: () => createLiveEngine,
	inspect: (engine) => ({
		database: engine.database.name,
		delivered: engine.server.delivered,
		publications: engine.server.publications,
		reads: engine.server.reads,
	}),
	layer: workerDatabase,
	name: "composed orders",
	runIf: hasPostgres,
	stages: ["commit", "editors"],
	verbs: (engine, story) => liveVerbs(engine, story.tell),
});
