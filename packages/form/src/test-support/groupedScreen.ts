import { Effect, Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { act, createElement } from "react";
import { expectNoReactWarnings, render } from "@shivaedev/test-story/client/adapters/react.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { useSubmit } from "#adapters/react.ts";
import * as Field from "#field.ts";
import { form } from "#form.ts";
import { numberInput } from "#numberInput.ts";
import { useFieldAt } from "#useFieldAt.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

function makeFood() {
	return form(Schema.Struct({ energy: Schema.Struct({ expected: Field.number(), high: Field.number(), low: Field.number() }) }), {
		initialValues: { energy: { expected: "20", high: "30", low: "10" } },
		onSubmit: Effect.succeed,
	});
}

function FoodScreen({ model }: { readonly model: ReturnType<typeof makeFood> }) {
	const low = useFieldAt(model, ["energy", "low"]);
	const expected = useFieldAt(model, ["energy", "expected"]);
	const submit = useSubmit(model);
	return createElement(
		"div",
		null,
		...[low, expected].map((field) =>
			createElement(
				"label",
				{ key: field.name },
				field.name,
				createElement("input", numberInput(field)),
				createElement("span", { "data-error": field.name }, field.error),
			),
		),
		createElement("button", { onClick: submit.run, type: "button" }, "Save"),
		createElement("output", null, AsyncResult.isSuccess(submit.result) ? JSON.stringify(submit.result.value) : "unsaved"),
	);
}

export const groupedScreen = storyKit({
	create: () =>
		Effect.acquireRelease(
			Effect.promise(() => render(createElement(FoodScreen, { model: makeFood() }))),
			(view) => Effect.promise(() => view.unmount()),
		),
	name: "grouped food inputs",
	stages: ["screen"],
	verbs: (view, story) => {
		const driver = screenDriver({ act, root: view.container, tell: story.tell });
		return {
			enterLow: (value: string) => driver.enter({ name: "energy.low", role: "textbox" }, value),
			feedback: () => Effect.sync(() => view.container.querySelector('[data-error="energy.low"]')?.textContent),
			saved: () => Effect.sync(() => view.container.querySelector("output")?.textContent),
			shownExpected: () => Effect.sync(() => driver.value({ name: "energy.expected", role: "textbox" })),
			submit: () => driver.click({ name: "Save", role: "button" }),
		};
	},
});
