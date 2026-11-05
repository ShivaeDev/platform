import { Effect } from "effect";
import { Pots } from "#test/diary/Pots.ts";

export const addPortion = Effect.fn("Plates.addPortion")(function* (id: number, amount: number) {
	const pots = yield* Pots;
	const pot = yield* pots.load(id);
	return yield* pots.rows.update({ ...pot, pending: pot.pending + amount });
});
