import { Option, Schema } from "effect";
import { createElement, Fragment, type ReactNode } from "react";
import { useField } from "@shivaedev/form/client/react.ts";
import type { Form } from "@shivaedev/form/shape.ts";
import { useCreate } from "#client/create.ts";
import { useEditor } from "#client/editor.ts";
import { QueryView } from "#client/QueryView.ts";
import type { InvoiceLine, makeInvoiceLineServer } from "./backend.ts";

export const InvoiceLineDraft = Schema.Struct({ name: Schema.String, quantity: Schema.NumberFromString });
type InvoiceLineFields = typeof InvoiceLineDraft.fields;
export function values(line: InvoiceLine) {
	return { name: line.name, quantity: String(line.quantity) };
}

function Input<E, TRuntimeError>({
	form,
	name,
}: {
	readonly form: Form<InvoiceLineFields, InvoiceLine, E, TRuntimeError>;
	readonly name: "name" | "quantity";
}) {
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
}

interface Saving<E, TRuntimeError> {
	readonly dirty: boolean;
	readonly failure: Option.Option<unknown>;
	readonly form: Form<InvoiceLineFields, InvoiceLine, E, TRuntimeError>;
	readonly save: () => void;
	readonly saving: boolean;
}

function saveStatus({ saving, dirty }: { readonly saving: boolean; readonly dirty: boolean }): string {
	if (saving) {
		return "Saving";
	}
	return dirty ? "Unsaved" : "Saved";
}

export function InvoiceLineForm<E, TRuntimeError>({
	editor,
	children,
	failureMessage = "Could not save",
}: {
	readonly editor: Saving<E, TRuntimeError>;
	readonly children?: ReactNode;
	readonly failureMessage?: string;
}) {
	return createElement(
		"form",
		{
			onSubmit: (event: { preventDefault: () => void }) => {
				event.preventDefault();
				editor.save();
			},
		},
		createElement(Input<E, TRuntimeError>, { form: editor.form, name: "name" }),
		createElement(Input<E, TRuntimeError>, { form: editor.form, name: "quantity" }),
		Option.isSome(editor.failure) && createElement("p", { role: "alert" }, failureMessage),
		createElement("button", { type: "submit" }, "Save"),
		createElement("p", { role: "status" }, saveStatus(editor)),
		children,
	);
}

type Server = ReturnType<typeof makeInvoiceLineServer>;

export function InvoiceLineScreen({ id, server: { api, runtime } }: { readonly id: number; readonly server: Server }) {
	const editor = useEditor({
		fields: InvoiceLineDraft,
		query: api.get.query({ id }),
		runtime,
		save: (line) => api.save.run({ expectedVersion: version, id, ...line }),
		values,
	});
	const version: number = Option.getOrElse(
		Option.map(editor.query.data, (line) => line.version),
		() => 1,
	);
	const { query, form } = editor;
	return createElement(
		"section",
		{ "data-pending": query.pending },
		createElement("button", { onClick: query.refresh, type: "button" }, "Refresh"),
		createElement(QueryView<InvoiceLine, unknown>, {
			content: (line) =>
				createElement(
					"div",
					null,
					createElement("output", null, `${line.name} / ${line.quantity}`),
					form && createElement(InvoiceLineForm, { editor: { ...editor, form } }),
				),
			failure: (_error, state) =>
				createElement(
					Fragment,
					null,
					createElement("p", { role: "alert" }, "Could not load"),
					createElement("button", { onClick: state.refresh, type: "button" }, "Retry"),
				),
			loading: () => createElement("p", null, "Loading"),
			query,
		}),
	);
}
export function InvoiceLineCreate({ server: { api, runtime } }: { readonly server: Server }) {
	const create = useCreate({
		create: api.create.run,
		fields: InvoiceLineDraft,
		initialValues: { name: "", quantity: "" },
		runtime,
	});
	const created = Option.map(create.created, (line) => createElement("output", null, `Created ${line.id}: ${line.name}`));
	return createElement(InvoiceLineForm, { editor: create }, Option.getOrNull(created));
}
