import type { Form } from "@shivaedev/effect-form";
import { useField } from "@shivaedev/effect-form/react";
import { Option, Schema } from "effect";
import { createElement, type ReactNode } from "react";
import { useCreate, useEditor } from "../../src/form.ts";
import type { Food, makeFoodServer } from "./backend.ts";

const fields = Schema.Struct({ name: Schema.String, grams: Schema.NumberFromString });
type FoodFields = typeof fields.fields;
const values = (food: Food) => ({ name: food.name, grams: String(food.grams) });

const Input = <E, ER>({ form, name }: { readonly form: Form<FoodFields, Food, E, ER>; readonly name: "name" | "grams" }) => {
	const field = useField(form, name);
	return createElement(
		"label",
		null,
		name,
		createElement("input", {
			name,
			value: field.value,
			onBlur: field.onBlur,
			onChange: (event: { readonly target: { readonly value: string } }) => field.onChange(event.target.value),
		}),
		field.error && createElement("em", { "data-error": name }, field.error),
	);
};

interface Saving<E, ER> {
	readonly form: Form<FoodFields, Food, E, ER>;
	readonly dirty: boolean;
	readonly saving: boolean;
	readonly failure: Option.Option<unknown>;
	readonly save: () => void;
}

const saveStatus = ({ saving, dirty }: { readonly saving: boolean; readonly dirty: boolean }): string => {
	if (saving) return "Saving";
	return dirty ? "Unsaved" : "Saved";
};

const FoodForm = <E, ER>({ editor, children }: { readonly editor: Saving<E, ER>; readonly children?: ReactNode }) =>
	createElement(
		"form",
		{
			onSubmit: (event: { preventDefault: () => void }) => {
				event.preventDefault();
				editor.save();
			},
		},
		createElement(Input<E, ER>, { form: editor.form, name: "name" }),
		createElement(Input<E, ER>, { form: editor.form, name: "grams" }),
		Option.isSome(editor.failure) && createElement("p", { role: "alert" }, "Could not save"),
		createElement("button", { type: "submit" }, "Save"),
		createElement("p", { role: "status" }, saveStatus(editor)),
		children,
	);

type Server = ReturnType<typeof makeFoodServer>;

export const makeFoodViews = ({ api, runtime }: Server) => {
	const FoodEditor = ({ id }: { readonly id: number }) => {
		const editor = useEditor({
			query: api.get.query({ id }),
			fields,
			values,
			runtime,
			save: (food) => api.save.run({ id, ...food }),
		});
		const { query, form } = editor;
		return createElement(
			"section",
			null,
			createElement("button", { type: "button", onClick: query.refresh }, "Refresh"),
			Option.isSome(query.cause) && createElement("p", { role: "alert" }, "Could not load"),
			Option.match(query.data, {
				onNone: () => createElement("p", null, "Loading"),
				onSome: (food) => createElement("output", null, `${food.name} / ${food.grams}`),
			}),
			form && createElement(FoodForm, { editor: { ...editor, form } }),
		);
	};
	const FoodCreate = () => {
		const create = useCreate({
			fields,
			initialValues: { name: "", grams: "" },
			runtime,
			create: api.create.run,
		});
		const created = Option.map(create.created, (food) => createElement("output", null, `Created ${food.id}: ${food.name}`));
		return createElement(FoodForm, { editor: create }, Option.getOrNull(created));
	};
	return { FoodEditor, FoodCreate };
};
