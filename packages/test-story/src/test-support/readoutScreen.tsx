import { Effect } from "effect";
import { act } from "react";
import { expectNoReactWarnings, render } from "@shivaedev/test-story/client/react.ts";
import { screenDriver } from "#screenDriver.ts";
import { storyKit } from "#storyKit.ts";
import { ReadoutsPage } from "./ReadoutsPage.tsx";

expectNoReactWarnings();

export const readoutScreen = storyKit({
	clock: "live",
	*create() {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
		const view = yield* Effect.acquireRelease(
			Effect.promise(() => render(<ReadoutsPage />)),
			(mounted) => Effect.promise(mounted.unmount),
		);
		return { view };
	},
	inspect: ({ view }) => ({ screen: view.container.innerHTML }),
	name: "screen readouts",
	stages: [],
	verbs: ({ view }, story) =>
		screenDriver({
			act: async (action) => {
				await act(action);
			},
			root: view.container,
			tell: story.tell,
		}),
});
