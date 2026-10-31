import { Context, Layer } from "effect";
import { storyKit } from "#storyKit.ts";

class PgBoss extends Context.Service<PgBoss, number>()("compiler/PgBoss") {}
class Ledger extends Context.Service<Ledger, number>()("compiler/Ledger") {}

storyKit({
	after: { built: () => undefined },
	*create() {
		return { jobs: yield* PgBoss, ledger: yield* Ledger };
	},
	layer: Layer.succeed(Ledger, 0),
	name: "partial layer",
	stages: ["built"],
	verbs: () => ({}),
});
