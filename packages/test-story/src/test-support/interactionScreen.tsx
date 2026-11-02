import { Effect } from "effect";
import { act } from "react";
import { expectNoReactWarnings, render } from "@shivaedev/test-story/client/react.ts";
import { screenDriver } from "#screenDriver.ts";
import { storyKit } from "#storyKit.ts";
import { InteractionPage } from "./InteractionPage.tsx";

expectNoReactWarnings();

export const interactionScreen = storyKit({
	clock: "live",
	*create() {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
		const view = yield* Effect.acquireRelease(
			Effect.promise(() => render(<InteractionPage />)),
			(mounted) => Effect.promise(mounted.unmount),
		);
		return { view };
	},
	inspect: ({ view }) => view.container.innerHTML,
	name: "screen interactions",
	stages: [],
	verbs: ({ view }, story) => {
		const lines: string[] = [];
		return {
			...screenDriver({
				act,
				root: view.container,
				tell: (line) => {
					lines.push(line);
					story.tell(line);
				},
			}),
			narration: () => [...lines],
		};
	},
});
