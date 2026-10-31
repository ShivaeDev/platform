import { Effect } from "effect";
import { act } from "react";
import { expectNoReactWarnings, render } from "@shivaedev/test-story/client/react.ts";
import { type ScreenTarget, screenDriver } from "#screenDriver.ts";
import { storyKit } from "#storyKit.ts";
import { background } from "./attempt.ts";
import { WaitPage } from "./WaitPage.tsx";

expectNoReactWarnings();

export const waitScreen = storyKit({
	clock: "live",
	*create() {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
		const previous = window.location.href;
		window.location.href = "http://localhost:3000/app";
		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				window.location.href = previous;
			}),
		);
		const view = yield* Effect.acquireRelease(
			Effect.promise(() => render(<WaitPage />)),
			(mounted) => Effect.promise(mounted.unmount),
		);
		return { view };
	},
	inspect: ({ view }) => ({ location: window.location.href, screen: view.container.ownerDocument.body.innerHTML }),
	name: "screen waits",
	stages: ["screen"],
	verbs: ({ view }, story) => {
		const driver = screenDriver({
			act: async (action) => {
				await act(action);
			},
			root: view.container,
			tell: story.tell,
		});
		const waits = background();
		return {
			...driver,
			cancelWait: () => waits.cancel("wait"),
			finished: () => waits.finished("wait"),
			location: () => window.location.href,
			navigationObserver: () => (Object.hasOwn(window.location, "href") ? "observing" : "released"),
			progress: () => waits.progress("wait", "waiting"),
			startsFindingText: (text: string | RegExp) => waits.starts("wait", driver.findText(text), (element) => element.className),
			startsGone: (target: ScreenTarget) => waits.starts("wait", driver.gone(target)),
			startsNavigation: (prefix: string) => waits.starts("wait", driver.navigatedAway(prefix)),
			unmount: () => Effect.promise(view.unmount),
		};
	},
});

export const duplicateText = waitScreen.trait("screen", "two visible readouts can have the same text", ({ view }) =>
	Effect.promise(() => view.render(<WaitPage duplicate />)),
);

export const openDialog = waitScreen.trait("screen", "Preferences is open in a portal", ({ view }) =>
	screenDriver({
		act: async (action) => {
			await act(action);
		},
		root: view.container,
		tell: () => undefined,
	}).click({ name: "Preferences", role: "button" }),
);

export const disabledSelect = waitScreen.trait("screen", "the plan select is disabled", ({ view }) =>
	Effect.promise(() => view.render(<WaitPage disabled />)),
);
