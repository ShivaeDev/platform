import { Context, Data, Effect } from "effect";
import { expectTypeOf, it } from "vitest";
import { settleEffect } from "#effect/settle.ts";
import { storyLog } from "#storyLog.ts";

class Shelves extends Context.Service<Shelves, number>()("@types/Shelves") {}

class Clerk extends Context.Service<Clerk, string>()("@types/Clerk") {}

class Ledger extends Context.Service<Ledger, string>()("@types/Ledger") {}

class Closed extends Data.TaggedError("Closed") {}

class Flooded extends Data.TaggedError("Flooded") {}

class Lost extends Data.TaggedError("Lost") {}

it("collects the errors and services of every member of the spec", () => {
	const log = storyLog({ storyOnFailure: false });

	const settled = settleEffect(log, {
		cap: 1,
		diagnose: Effect.flatMap(Ledger, () => Effect.fail(new Flooded())),
		failed: Effect.as(Effect.fail(new Closed()), undefined),
		report: Effect.as(Clerk, 1),
		settled: Effect.as(Shelves, true),
		step: Effect.fail(new Lost()),
	});

	expectTypeOf(settled).toEqualTypeOf<Effect.Effect<number, Closed | Flooded | Lost, Clerk | Ledger | Shelves>>();
});
