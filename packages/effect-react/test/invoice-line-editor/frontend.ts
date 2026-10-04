import { Option, Schema } from "effect";
import { createElement, type ReactNode } from "react";
import type { Form } from "@shivaedev/effect-form";
import { useField } from "@shivaedev/effect-form/react";
import { useCreate, useEditor } from "../../src/form.ts";
import type { InvoiceLine, makeInvoiceLineServer } from "./backend.ts";

const fields = Schema.Struct({ name: Schema.String, quantity: Schema.NumberFromString });
type InvoiceLineFields = typeof fields.fields;
const values = (line: InvoiceLine) => ({ name: line.name, quantity: String(line.quantity) });

const Input = <E, ER>({ form, name }: { readonly form: Form<InvoiceLineFields, InvoiceLine, E, ER>; readonly name: "name" | "quantity" }) => {
	const field = useField(form, name);
	return createElement(
		"label",
		null,
		name,
		createElement("input", {
			name,
			onBlur: field.onBlur,
			onChange: (event: { readonly target: { readonly value: string } }) => field.onChange(event.target.value),
			value: field.value,
		}),
		field.error && createElement("em", { "data-error": name }, field.error),
	);
};

interface Saving<E, ER> {
	readonly dirty: boolean;
	readonly failure: Option.Option<unknown>;
	readonly form: Form<InvoiceLineFields, InvoiceLine, E, ER>;
	readonly save: () => void;
	readonly saving: boolean;
}

const saveStatus = ({ saving, dirty }: { readonly saving: boolean; readonly dirty: boolean }): string => {
	if (saving) {
		return "Saving";
	}
	return dirty ? "Unsaved" : "Saved";
};

const InvoiceLineForm = <E, ER>({ editor, children }: { readonly editor: Saving<E, ER>; readonly children?: ReactNode }) =>
	createElement(
		"form",
		{
			onSubmit: (event: { preventDefault: () => void }) => {
				event.preventDefault();
				editor.save();
			},
		},
		createElement(Input<E, ER>, { form: editor.form, name: "name" }),
		createElement(Input<E, ER>, { form: editor.form, name: "quantity" }),
		Option.isSome(editor.failure) && createElement("p", { role: "alert" }, "Could not save"),
		createElement("button", { type: "submit" }, "Save"),
		createElement("p", { role: "status" }, saveStatus(editor)),
		children,
	);

type Server = ReturnType<typeof makeInvoiceLineServer>;

export const makeInvoiceLineViews = ({ api, runtime }: Server) => {
	const InvoiceLineEditor = ({ id }: { readonly id: number }) => {
		const editor = useEditor({
			fields,
			query: api.get.query({ id }),
			runtime,
			save: (line) => api.save.run({ id, ...line }),
			values,
		});
		const { query, form } = editor;
		return createElement(
			"section",
			null,
			createElement("button", { onClick: query.refresh, type: "button" }, "Refresh"),
			Option.isSome(query.cause) && createElement("p", { role: "alert" }, "Could not load"),
			Option.match(query.data, {
				onNone: () => createElement("p", null, "Loading"),
				onSome: (line) => createElement("output", null, `${line.name} / ${line.quantity}`),
			}),
			form && createElement(InvoiceLineForm, { editor: { ...editor, form } }),
		);
	};
	const InvoiceLineCreate = () => {
		const create = useCreate({
			create: api.create.run,
			fields,
			initialValues: { name: "", quantity: "" },
			runtime,
		});
		const created = Option.map(create.created, (line) => createElement("output", null, `Created ${line.id}: ${line.name}`));
		return createElement(InvoiceLineForm, { editor: create }, Option.getOrNull(created));
	};
	return { InvoiceLineCreate, InvoiceLineEditor };
};
