import { Effect } from "effect";
import { act, createElement } from "react";
import { expectNoReactWarnings, render } from "@shivaedev/test-story/client/adapters/react.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makeQuickAmounts, QuickAmounts } from "#test/quickAmounts.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

export const listScreen = storyKit({
	create: () =>
		Effect.acquireRelease(
			Effect.promise(() => render(createElement(QuickAmounts, { model: makeQuickAmounts() }))),
			(view) => Effect.promise(() => view.unmount()),
		),
	inspect: (view) => view.container.innerHTML,
	name: "quick amount list",
	stages: ["screen"],
	verbs: (view, story) => {
		const driver = screenDriver({ act, root: view.container, tell: story.tell });
		return {
			add: () => driver.click({ name: "Add amount", role: "button" }),
			edit: (id: string, amount: string) => driver.enter(`input[name="${id}"]`, amount),
			items: () => Effect.sync(() => Array.from(view.container.querySelectorAll("input"), (input) => ({ amount: input.value, id: input.name }))),
			message: (id: string) => Effect.sync(() => view.container.querySelector(`[data-item="${id}"] [role="alert"]`)?.textContent),
			remove: (id: string) => driver.click({ name: `Remove ${id}`, role: "button" }),
			saved: () => Effect.sync(() => view.container.querySelector("output")?.textContent),
			submit: () => driver.click({ name: "Save", role: "button" }),
			summary: () => Effect.sync(() => view.container.querySelector("[data-summary]")?.textContent),
		};
	},
});
