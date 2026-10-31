import { Context } from "effect";
import { storyKit } from "#storyKit.ts";

class PgBoss extends Context.Service<PgBoss, number>()("compiler/PgBoss") {}

storyKit({
	after: { built: () => undefined },
	*create() {
		return { jobs: yield* PgBoss };
	},
	name: "missing layer",
	stages: ["built"],
	verbs: () => ({}),
});
