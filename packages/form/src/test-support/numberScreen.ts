import { Effect, Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { act, createElement } from "react";
import { expectNoReactWarnings, render } from "@shivaedev/test-story/client/adapters/react.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { useField, useSubmit } from "#adapters/react.ts";
import * as Field from "#field.ts";
import { form } from "#form.ts";
import { numberInput } from "#numberInput.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

function makeNumbers() {
	return form(Schema.Struct({ amount: Field.number({ integer: true, max: 100, min: 0, optional: true }), portion: Field.number() }), {
		initialValues: { amount: "7", portion: "1" },
		onSubmit: Effect.succeed,
	});
}

function NumberScreen({ model }: { readonly model: ReturnType<typeof makeNumbers> }) {
	const amount = useField(model, "amount");
	const portion = useField(model, "portion");
	const submit = useSubmit(model);
	return createElement(
		"div",
		null,
		...[amount, portion].map((field) =>
			createElement(
				"div",
				{ key: field.name },
				createElement("label", null, field.name, createElement("input", numberInput(field))),
				createElement("span", { "data-error": field.name, role: "alert" }, field.error),
			),
		),
		createElement("button", { onClick: submit.run, type: "button" }, "Save"),
		createElement("output", null, AsyncResult.isSuccess(submit.result) ? JSON.stringify(submit.result.value) : "unsaved"),
	);
}

export const numberScreen = storyKit({
	create: () =>
		Effect.acquireRelease(
			Effect.promise(() => render(createElement(NumberScreen, { model: makeNumbers() }))),
			(view) => Effect.promise(() => view.unmount()),
		),
	inspect: (view) => view.container.innerHTML,
	name: "number inputs",
	stages: ["screen"],
	verbs: (view, story) => {
		const driver = screenDriver({ act, root: view.container, tell: story.tell });
		return {
			enter: (name: "amount" | "portion", value: string) => driver.enter({ name, role: "textbox" }, value),
			leave: (name: "amount" | "portion") => driver.blur({ name, role: "textbox" }),
			message: (name: "amount" | "portion") => Effect.sync(() => view.container.querySelector(`[data-error="${name}"]`)?.textContent),
			saved: () => Effect.sync(() => view.container.querySelector("output")?.textContent),
			shown: (name: "amount" | "portion") => Effect.sync(() => driver.value({ name, role: "textbox" })),
			submit: () => driver.click({ name: "Save", role: "button" }),
		};
	},
});
