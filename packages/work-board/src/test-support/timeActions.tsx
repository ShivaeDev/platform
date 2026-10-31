import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { act } from "react";
import type { ScreenEngine } from "./screenEngine.ts";
export function timeActions(engine: ScreenEngine, tell: (line: string) => void) {
	return {
		advanceClock: (milliseconds: number) =>
			Effect.gen(function* () {
				tell(`the runtime clock advances ${milliseconds} milliseconds`);
				const run = Effect.runPromiseWith(yield* Effect.context());
				yield* Effect.promise(() => act(() => run(TestClock.adjust(milliseconds))));
			}),
		refreshTime: async (millisecondsAgo: number) => {
			tell(`the timestamp refreshes to ${millisecondsAgo} milliseconds earlier`);
			if (!engine.view || engine.time === undefined) {
				throw new Error("The time screen has not opened");
			}
			await engine.view.render(engine.time.view(engine.time.at - millisecondsAgo));
		},
	};
}
