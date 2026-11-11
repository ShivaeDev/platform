import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";

export function settleScreen(root: HTMLElement, pending: () => boolean, tell: (line: string) => void) {
	return screenDriver({
		act: async (action) => {
			await act(action);
		},
		pending,
		root,
		tell,
	}).settle();
}
