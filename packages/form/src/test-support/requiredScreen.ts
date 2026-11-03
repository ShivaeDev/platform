import { Effect } from "effect";
import { act, createElement } from "react";
import { expectNoReactWarnings, render } from "@shivaedev/test-story/client/adapters/react.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { useField } from "#adapters/react.ts";
import { form } from "#form.ts";
import { RequiredFields, requiredConfig } from "./requiredFields.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

function RequiredScreen({ order }: { readonly order: ReturnType<typeof makeRequiredForm> }) {
	const name = useField(order, "name");
	return createElement(
		"label",
		null,
		"Name",
		createElement("input", {
			name: name.name,
			onBlur: name.onBlur,
			onChange: (event) => name.onChange(event.currentTarget.value),
			value: name.value,
		}),
		name.error && createElement("span", { role: "alert" }, name.error),
	);
}

function makeRequiredForm() {
	return form(RequiredFields, requiredConfig);
}

export const requiredScreen = storyKit({
	clock: "live",
	create: () =>
		Effect.acquireRelease(
			Effect.promise(() => render(createElement(RequiredScreen, { order: makeRequiredForm() }))),
			(view) => Effect.promise(() => view.unmount()),
		),
	inspect: (view) => view.container.innerHTML,
	name: "required name screen",
	stages: ["screen"],
	verbs: (view, story) => {
		const driver = screenDriver({ act, root: view.container, tell: story.tell });
		return {
			focusName: () => driver.focus({ name: "Name", role: "textbox" }),
			leaveName: () => driver.blur({ name: "Name", role: "textbox" }),
			message: () => Effect.sync(() => view.container.querySelector('[role="alert"]')?.textContent),
		};
	},
});
