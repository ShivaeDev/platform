import { act } from "react";
import { vi } from "vitest";
import type { ScreenEngine } from "./screenEngine.ts";
export function ageActions(engine: ScreenEngine, tell: (line: string) => void) {
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
		refreshAge: async (millisecondsAgo: number) => {
			tell(`the timestamp refreshes to ${millisecondsAgo} milliseconds earlier`);
			if (!engine.view || engine.age === undefined) {
				throw new Error("The age screen has not opened");
			}
			await engine.view.render(engine.age.view(engine.age.modified - millisecondsAgo));
		},
	};
}
