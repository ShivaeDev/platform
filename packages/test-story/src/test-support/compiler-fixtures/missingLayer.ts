import { Context } from "effect";
import { storyKit } from "#server/storyKit.ts";

class PgBoss extends Context.Service<PgBoss, number>()("@shivaedev/test-story/compiler/PgBoss") {}

storyKit({
	after: { built: () => undefined },
	*create() {
		return { jobs: yield* PgBoss };
	},
	name: "missing layer",
	stages: ["built"],
	verbs: () => ({}),
});
