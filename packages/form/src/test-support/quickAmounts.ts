import { Effect, Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { createElement, useRef } from "react";
import { useSubmit } from "#adapters/react.ts";
import { useList } from "#adapters/useList.ts";
import * as Field from "#field.ts";
import { form } from "#form.ts";
import { numberInput } from "#numberInput.ts";

export function makeQuickAmounts() {
	return form(
		Schema.Struct({ amounts: Field.list(Schema.Struct({ amount: Field.number({ max: 100, min: 1 }), id: Schema.String }), { max: 5, min: 1 }) }),
		{
			arrayKeys: { amounts: (item) => item.id },
			initialValues: {
				amounts: [
					{ amount: "1", id: "first" },
					{ amount: "2", id: "second" },
				],
			},
			onSubmit: (values, submitter) => {
				const rejected = values.amounts.findIndex((item) => item.amount === 13);
				return rejected < 0 ? Effect.succeed(values) : submitter.fail(["amounts", rejected, "amount"], "This amount is unavailable");
			},
		},
	);
}

export function QuickAmounts({ model }: { readonly model: ReturnType<typeof makeQuickAmounts> }) {
	const amounts = useList(model, "amounts");
	const nextIdRef = useRef(3);
	const submit = useSubmit(model);
	return createElement(
		"div",
		null,
		...amounts.items.map((item) =>
			createElement(
				"div",
				{ "data-item": item.value.id, key: item.value.id },
				createElement(
					"label",
					null,
					`Amount ${item.value.id}`,
					createElement(
						"input",
						numberInput({
							name: item.value.id,
							onBlur: amounts.onBlur,
							onChange: (amount) => item.onChange({ ...item.value, amount }),
							value: item.value.amount,
						}),
					),
				),
				createElement("span", { role: "alert" }, item.error),
				createElement("button", { onClick: item.onRemove, type: "button" }, `Remove ${item.value.id}`),
			),
		),
		createElement("p", { "data-summary": true }, amounts.error),
		createElement(
			"button",
			{
				onClick: () => {
					amounts.add({ amount: "3", id: String(nextIdRef.current) });
					nextIdRef.current += 1;
				},
				type: "button",
			},
			"Add amount",
		),
		createElement("button", { onClick: submit.run, type: "button" }, "Save"),
		createElement(
			"output",
			null,
			AsyncResult.isSuccess(submit.result) ? submit.result.value.amounts.map(({ amount, id }) => `${id}=${amount}`).join(", ") : "unsaved",
		),
	);
}
