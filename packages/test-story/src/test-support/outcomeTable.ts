import { Data, Effect } from "effect";
import { storyKit } from "#storyKit.ts";

export class ReadoutUnavailable extends Data.TaggedError("ReadoutUnavailable")<{ readonly message: string }> {}

export const outcomeTable = storyKit({
	create: () => ({ count: 0 }),
	name: "outcome table",
	stages: [],
	verbs: (state, story) => ({
		count: () => Effect.sync(() => state.count),
		details: () => Effect.sync(() => ({ counter: { reading: { value: state.count }, status: "ready" }, status: "ready" })),
		next: () => {
			story.tell(`read after ${state.count} readings`);
			return Effect.gen(function* () {
				yield* Effect.yieldNow;
				state.count += 1;
				story.tell(`received reading ${state.count}`);
				return state.count;
			});
		},
		unavailable: (): Effect.Effect<number, ReadoutUnavailable> => Effect.fail(new ReadoutUnavailable({ message: "the counter is unavailable" })),
	}),
});
