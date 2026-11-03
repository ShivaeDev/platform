import { Context, Effect } from "effect";
import { storyKit } from "#server/storyKit.ts";

class PgBoss extends Context.Service<PgBoss, number>()("compiler/PgBoss") {}

storyKit({
	create: () => Effect.map(PgBoss, (jobs) => ({ jobs })),
	name: "effect creation",
	stages: [],
	verbs: () => ({}),
});
