import { useAtomMount } from "@effect/atom-react";
import { Option, Schema } from "effect";
import { createElement } from "react";
import { useField } from "@shivaedev/effect-form/react.ts";
import { useEditor } from "#editor.ts";
import { Order } from "./contract.ts";
import type { makeClient } from "./makeClient.ts";

const Draft = Schema.Struct({ name: Order.fields.name, quantity: Schema.NumberFromString });
function values(order: Order) {
	return { name: order.name, quantity: String(order.quantity) };
}
function useOrderEditor(client: ReturnType<typeof makeClient>) {
	useAtomMount(client.connection);
	return useEditor({
		fields: Draft,
		query: client.query,
		runtime: client.Client.runtime,
		save: (input) => client.api.save.run({ id: 1, ...input }),
		values,
	});
}
function DraftFields({ form }: { readonly form: NonNullable<ReturnType<typeof useOrderEditor>["form"]> }) {
	const name = useField(form, "name");
	const quantity = useField(form, "quantity");
	return createElement(
		"fieldset",
		null,
		createElement("input", { "aria-label": "Name", name: "name", onChange: (event) => name.onChange(event.target.value), value: name.value }),
		createElement("input", {
			"aria-label": "Quantity",
			name: "quantity",
			onChange: (event) => quantity.onChange(event.target.value),
			value: quantity.value,
		}),
	);
}
export function OrderEditor({ client }: { readonly client: ReturnType<typeof makeClient> }) {
	const editor = useOrderEditor(client);
	const order = Option.getOrUndefined(editor.query.data);
	return createElement(
		"form",
		{
			onSubmit: (event) => {
				event.preventDefault();
				editor.save();
			},
		},
		createElement("output", null, order && `${order.name} / ${order.quantity}`),
		editor.form && createElement(DraftFields, { form: editor.form }),
		createElement("button", { disabled: editor.saving, type: "submit" }, "Save"),
		createElement("button", { onClick: editor.revert, type: "button" }, "Revert"),
		createElement("span", { role: "status" }, editor.dirty ? "Unsaved changes" : "Saved"),
	);
}
