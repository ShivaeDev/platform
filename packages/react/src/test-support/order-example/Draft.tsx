import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { createElement, useId } from "react";
import { useDirty, useField, useSubmit } from "@shivaedev/form/client/react.ts";
import type { Form } from "@shivaedev/form/shape.ts";
import type { Order } from "./contract.ts";
import type { DraftFields } from "./fields.ts";

function saveStatus(submitting: boolean, dirty: boolean): string {
	if (submitting) {
		return "Saving…";
	}
	return dirty ? "Unsaved changes" : "Saved";
}

export function Draft<E, TErrorRuntime>({ form }: { readonly form: Form<typeof DraftFields.fields, Order, E, TErrorRuntime> }) {
	const nameErrorId = useId();
	const quantityErrorId = useId();
	const name = useField(form, "name");
	const quantity = useField(form, "quantity");
	const submit = useSubmit(form);
	const dirty = useDirty(form);
	const failure = Option.getOrUndefined(AsyncResult.error(submit.result));
	const generalFailure =
		failure !== undefined
		&& typeof failure === "object"
		&& failure !== null
		&& "_tag" in failure
		&& failure._tag !== "FieldFailure"
		&& failure._tag !== "Invalid";
	return createElement(
		"form",
		{
			onSubmit: (event) => {
				event.preventDefault();
				if (!submit.submitting) {
					submit.run();
				}
			},
		},
		createElement(
			"label",
			null,
			"Name",
			createElement("input", {
				"aria-describedby": name.error ? nameErrorId : undefined,
				"aria-invalid": name.error !== undefined,
				name: name.name,
				onBlur: name.onBlur,
				onChange: (event) => name.onChange(event.target.value),
				value: name.value,
			}),
		),
		name.error && createElement("p", { id: nameErrorId, role: "alert" }, name.error),
		createElement(
			"label",
			null,
			"Quantity",
			createElement("input", {
				"aria-describedby": quantity.error ? quantityErrorId : undefined,
				"aria-invalid": quantity.error !== undefined,
				inputMode: "decimal",
				name: quantity.name,
				onBlur: quantity.onBlur,
				onChange: (event) => quantity.onChange(event.target.value),
				value: quantity.value,
			}),
		),
		quantity.error && createElement("p", { id: quantityErrorId, role: "alert" }, quantity.error),
		generalFailure && createElement("p", { role: "alert" }, "Could not save your order. Try again."),
		createElement("button", { disabled: submit.submitting, type: "submit" }, "Save"),
		createElement("button", { disabled: submit.submitting, onClick: form.revert, type: "button" }, "Revert"),
		createElement("p", { role: "status" }, saveStatus(submit.submitting, dirty)),
	);
}
