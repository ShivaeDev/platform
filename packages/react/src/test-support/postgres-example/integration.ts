import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { hasPostgres, orderDatabase } from "#test/order-example/postgres.ts";
import { createLiveEngine } from "./liveEngine.ts";
import { liveVerbs } from "./liveVerbs.ts";

export const integration = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => createLiveEngine,
	inspect: (engine) => ({
		delivered: engine.server.delivered,
		publications: engine.server.publications,
		reads: engine.server.reads,
	}),
	layer: orderDatabase,
	name: "composed orders",
	runIf: hasPostgres,
	stages: ["commit", "editors"],
	verbs: (engine, story) => liveVerbs(engine, story.tell),
});
