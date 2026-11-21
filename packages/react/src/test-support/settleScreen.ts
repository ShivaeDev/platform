import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import type { ScreenSignal } from "@shivaedev/test-story/server/screenSignal.ts";

export function settleScreen(root: HTMLElement, pending: () => boolean, tell: (line: string) => void, activity?: ScreenSignal) {
	return screenDriver({
		act: async (action) => {
			await act(action);
		},
		...(activity === undefined ? {} : { activity }),
		pending,
		root,
		tell,
	}).settle();
}
