import { Effect } from "effect";
import { Pots } from "#test/diary/Pots.ts";

export const loadPot = Effect.fn("Plates.loadPot")(function* (id: number) {
	return yield* (yield* Pots).load(id);
});
