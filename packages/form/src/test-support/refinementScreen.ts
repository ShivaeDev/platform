import { useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import { act, createElement } from "react";
import { expectNoReactWarnings, render } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { useSubmit } from "#client/react.ts";
import { form } from "#form.ts";
import { Passwords } from "./schemaMessages.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

function makePasswords() {
	return form(Passwords, { initialValues: { confirmation: "second", password: "first" }, onSubmit: Effect.succeed });
}
function PasswordScreen({ passwords }: { readonly passwords: ReturnType<typeof makePasswords> }) {
	const submit = useSubmit(passwords);
	const message = useAtomValue(passwords.errorAt([]));
	return createElement(
		"div",
		null,
		createElement("button", { onClick: submit.run, type: "button" }, "Save"),
		message && createElement("p", { role: "alert" }, message),
	);
}
export const refinementScreen = storyKit({
	clock: "live",
	create: () =>
		Effect.acquireRelease(
			Effect.promise(() => render(createElement(PasswordScreen, { passwords: makePasswords() }))),
			(view) => Effect.promise(() => view.unmount()),
		),
	inspect: (view) => view.container.innerHTML,
	name: "password refinement screen",
	stages: ["screen"],
	verbs: (view, story) => ({
		message: () => Effect.sync(() => view.container.querySelector('[role="alert"]')?.textContent),
		submit: () =>
			Effect.promise(async () => {
				story.tell("submit the mismatched passwords");
				await act(() => {
					const button = view.container.querySelector("button");
					if (button === null) {
						throw new Error("The Save button is missing");
					}
					button.click();
				});
			}),
	}),
});
