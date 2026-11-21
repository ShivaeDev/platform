import type { Clock } from "effect";
import { Effect } from "effect";
import { activityScreenSignal } from "@shivaedev/contract/clientActivity.ts";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import type { NoticeScreen } from "#test/notices/view.tsx";
import type { Screen } from "#test/Screen.ts";
import { settleScreen } from "#test/settleScreen.ts";

export interface State {
	clock?: Clock.Clock;
	current: NoticeScreen;
	typed: string;
	view?: Rendered;
}

export function view(state: State) {
	if (!state.view) {
		throw new Error("Notice screen is not open");
	}
	return state.view;
}

export function settle(state: State, screen: Screen) {
	return Effect.suspend(() => {
		const { container } = view(state);
		const { client } = state.current;
		return settleScreen(
			container,
			() => container.querySelector('[data-pending="true"]') !== null,
			screen.tell,
			activityScreenSignal(client.activity, client.settled),
		);
	});
}
