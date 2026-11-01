import { Effect } from "effect";
import { act } from "react";
import { expectNoReactWarnings, type Rendered, render } from "@shivaedev/test-story/client/react.ts";
import { type ScreenDriverOptions, screenDriver } from "#screenDriver.ts";
import { storyKit } from "#storyKit.ts";
import { refusal } from "./attempt.ts";
import { type LoadingIndicator, LoadingPage } from "./LoadingPage.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

interface State {
	budgets: Pick<ScreenDriverOptions, "loadingTimeoutMs" | "timeoutMs">;
	delay: number;
	hidden: boolean;
	indicator: LoadingIndicator;
	missing: boolean;
	view?: Rendered;
}

export const loadingScreen = storyKit({
	after: {
		*screen(state) {
			state.view = yield* Effect.acquireRelease(
				Effect.promise(() => render(<LoadingPage {...state} />)),
				(view) => Effect.promise(view.unmount),
			);
		},
	},
	clock: "live",
	create: (): State => ({ budgets: { loadingTimeoutMs: 500, timeoutMs: 40 }, delay: 120, hidden: false, indicator: "none", missing: false }),
	inspect: ({ view }) => ({ screen: view?.container.ownerDocument.body.innerHTML }),
	name: "loading screen",
	stages: ["screen"],
	verbs: (state, story) => {
		const view = state.view;
		if (view === undefined) {
			throw new Error("The loading screen is not open");
		}
		const root = view.container.firstElementChild;
		if (!(root instanceof HTMLElement)) {
			throw new Error("The loading screen has no root");
		}
		const driver = screenDriver({ ...state.budgets, act, root, tell: story.tell });
		let elapsed = 0;
		function timed<A>(action: Effect.Effect<A>) {
			return Effect.gen(function* () {
				const started = performance.now();
				const result = yield* action;
				elapsed = performance.now() - started;
				return result;
			});
		}
		return {
			clickSave: () => timed(driver.find({ name: "Save", role: "button" }).pipe(Effect.andThen(driver.click({ name: "Save", role: "button" })))),
			elapsed: () => Effect.sync(() => elapsed),
			find: (options?: { readonly timeout?: number }) => timed(refusal(driver.find({ name: "Save", role: "button" }, options))),
			findScoped: () => timed(refusal(driver.within(".controls").find({ name: "Save", role: "button" }))),
			findText: () => timed(refusal(driver.findText("Save"))),
			text: () => Effect.sync(() => driver.text()),
		};
	},
});

export function loading(indicator: LoadingIndicator) {
	return loadingScreen.trait("screen", `the screen shows ${indicator}`, (state) => {
		state.indicator = indicator;
	});
}

export const hiddenLoading = loadingScreen.trait("screen", "the loading indicator is hidden", (state) => {
	state.hidden = true;
});

export const stuckLoading = loadingScreen.trait("screen", "loading never finishes within the longer budget", (state) => {
	state.delay = 60_000;
});

export const missingSave = loadingScreen.trait("screen", "loading ends without a Save button", (state) => {
	state.missing = true;
});

export const defaultBudgets = loadingScreen.trait("screen", "rendering takes longer than the default find budget", (state) => {
	state.delay = 3300;
	state.budgets = {};
});
