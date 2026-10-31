import { Effect } from "effect";
import { createElement, type ReactNode } from "react";
import { expectNoReactWarnings, render } from "@shivaedev/test-story/client/react.ts";
import { screenDriver } from "#screenDriver.ts";
import { storyKit } from "#storyKit.ts";

expectNoReactWarnings();

export const textScreen = storyKit({
	clock: "live",
	*create() {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
		const view = yield* Effect.acquireRelease(
			Effect.promise(() => render(createElement("main"))),
			(mounted) => Effect.promise(mounted.unmount),
		);
		return { view };
	},
	inspect: ({ view }) => ({ screen: view.container.innerHTML }),
	name: "screen text",
	stages: ["screen"],
	verbs: ({ view }, story) => screenDriver({ root: view.container, tell: story.tell }),
});

function showing(...content: readonly ReactNode[]) {
	return textScreen.trait("screen", "the screen shows the readout", ({ view }) =>
		Effect.promise(() => view.render(createElement("main", null, ...content))),
	);
}

export const card = showing(
	createElement(
		"article",
		{ "aria-label": "News" },
		createElement("header", null, createElement("h2", null, "Today's news")),
		createElement("p", null, "Read the latest stories."),
		createElement("footer", null, createElement("button", { type: "button" }, "Read more")),
	),
);

export const inlineSentence = showing(
	createElement("p", null, "Read ", createElement("em", null, "today's"), " news", createElement("strong", null, "!")),
);

export const surroundedBlock = showing("Before", createElement("div", null, "Inside"), "After");

export const styledDisplays = showing(
	createElement("span", { style: { display: "block" } }, "First"),
	createElement("span", { style: { display: "block" } }, "Second"),
	createElement("p", { style: { display: "inline" } }, "Joined"),
	createElement("p", { style: { display: "inline" } }, "Together"),
);

export const lineBreak = showing(createElement("p", null, "First", createElement("br"), "Second"));

export const hiddenBlock = showing(
	createElement(
		"p",
		null,
		"Read",
		createElement("span", { style: { display: "none" } }, createElement("span", { style: { display: "block" } }, "Hidden")),
		"more",
	),
);

export const spacedBlocks = showing(createElement("p", null, "First "), createElement("p", null, "Second"));
