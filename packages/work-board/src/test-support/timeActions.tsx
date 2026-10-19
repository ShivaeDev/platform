import { act } from "react";
import { vi } from "vitest";
import type { ScreenEngine } from "./screenEngine.ts";
export function timeActions(engine: ScreenEngine, tell: (line: string) => void) {
	return {
		advanceTime: async (milliseconds: number) => {
			tell(`time advances ${milliseconds} milliseconds`);
			await act(() => vi.advanceTimersByTimeAsync(milliseconds));
		},
		freezeTimers: (step: () => void) => {
			tell("timers started during the next step never fire");
			vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
			try {
				step();
			} finally {
				vi.useRealTimers();
			}
		},
		readTimerCount: () => {
			tell("the reader checks the timers still owned by the view");
			return vi.getTimerCount();
		},
		refreshTime: async (millisecondsAgo: number) => {
			tell(`the timestamp refreshes to ${millisecondsAgo} milliseconds earlier`);
			if (!engine.view || engine.time === undefined) {
				throw new Error("The time screen has not opened");
			}
			await engine.view.render(engine.time.view(engine.time.at - millisecondsAgo));
		},
	};
}
