import { Effect } from "effect";
import { act } from "react";
import { expectNoReactWarnings, render } from "@shivaedev/test-story/client/adapters/react.ts";
import { screenDriver } from "#server/screenDriver.ts";
import { storyKit } from "#server/storyKit.ts";
import { InteractionPage } from "./InteractionPage.tsx";

expectNoReactWarnings();

export const interactionScreen = storyKit({
	clock: "test",
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
		const driver = screenDriver({
			act,
			root: view.container,
			tell: (line) => {
				lines.push(line);
				story.tell(line);
			},
		});
		const previousRoot = view.container.querySelector("main");
		if (!previousRoot) {
			throw new Error("The interaction screen has no main region.");
		}
		const previous = screenDriver({ act, root: previousRoot, tell: story.tell });
		return {
			...driver,
			detachesScreen: () => {
				story.tell("React replaces the screen while a verb still holds its previous scope");
				return Effect.promise(() => view.render(<p>Screen closed</p>));
			},
			narration: () => [...lines],
			previousScreen: previous,
		};
	},
});
