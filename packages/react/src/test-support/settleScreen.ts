import { act } from "react";
import { activityScreenSignal, type ClientActivity } from "@shivaedev/contract/clientActivity.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";

export function settleScreen(root: HTMLElement, pending: () => boolean, tell: (line: string) => void, activity?: ClientActivity) {
	return screenDriver({
		act: async (action) => {
			await act(action);
		},
		...(activity === undefined ? {} : { activity: activityScreenSignal(activity) }),
		pending,
		root,
		tell,
	}).settle();
}
