import { Effect, Schema } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { expectNoReactWarnings, render } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { useField, useSubmit } from "#client/react.ts";
import { form } from "#form.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

function makeNameForm() {
	return form(Schema.Struct({ name: Schema.NonEmptyString }), {
		initialValues: { name: "ada" },
		onSubmit: (_value, submitter) => submitter.fail("name", "Already used"),
	});
}

function NameScreen({ model }: { readonly model: ReturnType<typeof makeNameForm> }) {
	const name = useField(model, "name");
	const submit = useSubmit(model);
	return createElement(
		"div",
		null,
		createElement(
			"label",
			null,
			"Name",
			createElement("input", {
				name: name.name,
				onBlur: name.onBlur,
				onInput: (event) => name.onChange(event.currentTarget.value),
				value: name.value,
			}),
		),
		name.error && createElement("span", { role: "alert" }, name.error),
		createElement("button", { onClick: submit.run, type: "button" }, "Save"),
	);
}

export const rejectedNameScreen = storyKit({
	clock: "live",
	create: () =>
		Effect.acquireRelease(
			Effect.promise(async () => {
				const model = makeNameForm();
				const view = await render(createElement(NameScreen, { model }));
				return { model, view };
			}),
			({ view }) => Effect.promise(() => view.unmount()),
		),
	inspect: ({ view }) => view.container.innerHTML,
	name: "rejected name screen",
	stages: ["screen"],
	verbs: ({ model, view }, story) => {
		function input() {
			const element = view.container.querySelector("input");
			if (element === null) {
				throw new Error("The name input is missing");
			}
			return element;
		}
		function perform(line: string, action: () => void | Promise<void>) {
			return Effect.promise(async () => {
				story.tell(line);
				await act(action);
			});
		}
		return {
			enterName: (value: string) =>
				perform(`enter ${JSON.stringify(value)} as the name`, () => {
					input().value = value;
					input().dispatchEvent(new Event("input", { bubbles: true }));
				}),
			focusName: () => perform("focus the name", () => input().focus()),
			leaveName: () => perform("leave the name", () => input().blur()),
			message: () => Effect.sync(() => view.container.querySelector('[role="alert"]')?.textContent),
			submit: () =>
				perform("submit the name", async () => {
					const button = view.container.querySelector("button");
					if (button === null) {
						throw new Error("The Save button is missing");
					}
					button.click();
					await Effect.runPromise(Effect.exit(AtomRegistry.getResult(view.registry, model.submit, { suspendOnWaiting: true })));
				}),
		};
	},
});
