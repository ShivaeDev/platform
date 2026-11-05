import { Effect } from "effect";
import { Pots } from "#test/diary/Pots.ts";

export const settlePot = Effect.fn("PotLifecycle.settlePot")(function* (id: number) {
	return yield* (yield* Pots).settle(id);
});
