import { Effect } from "effect";
import { act, createElement } from "react";
import { expectNoReactWarnings, render } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { useField } from "#client/react.ts";
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
	verbs: (view, story) => ({
		leaveName: () =>
			Effect.promise(async () => {
				story.tell("leave the empty name");
				await act(() => {
					const input = view.container.querySelector("input");
					if (input === null) {
						throw new Error("The name input is missing");
					}
					input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
				});
			}),
		message: () => Effect.sync(() => view.container.querySelector('[role="alert"]')?.textContent),
	}),
});
