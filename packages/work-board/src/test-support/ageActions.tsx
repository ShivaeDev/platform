import { act } from "react";
import { vi } from "vitest";
import { Age, AgeTicker } from "#client/react/Age.tsx";
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
		refreshAge: async (millisecondsAgo: number) => {
			tell(`the timestamp refreshes to ${millisecondsAgo} milliseconds earlier`);
			if (!engine.view || engine.ageModified === undefined) {
				throw new Error("The age screen has not opened");
			}
			await engine.view.render(
				<AgeTicker>
					<Age modified={engine.ageModified - millisecondsAgo} short />
				</AgeTicker>,
			);
		},
	};
}
