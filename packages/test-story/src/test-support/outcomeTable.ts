import { Data, Effect } from "effect";
import { storyKit } from "#storyKit.ts";

export class ReadoutUnavailable extends Data.TaggedError("ReadoutUnavailable")<{ readonly message: string }> {}

export const outcomeTable = storyKit({
	create: () => ({ count: 0 }),
	name: "outcome table",
	stages: [],
	verbs: (state) => ({
		count: () => Effect.sync(() => state.count),
		details: () => Effect.sync(() => ({ count: state.count, status: "ready" })),
		next: () =>
			Effect.gen(function* () {
				yield* Effect.yieldNow;
				state.count += 1;
				return state.count;
			}),
		unavailable: (): Effect.Effect<number, ReadoutUnavailable> => Effect.fail(new ReadoutUnavailable({ message: "the counter is unavailable" })),
	}),
});
