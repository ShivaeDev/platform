import { RegistryContext } from "@effect/atom-react";
import { type Submit, useSubmit } from "@shivaedev/effect-form/react";
import { Effect, Layer, Option, Schema, SchemaGetter } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { type Create, type Editor, useCreate, useEditor } from "../src/form.ts";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) {
		await cleanup();
	}
});

const fields = Schema.Struct({ name: Schema.String });
type NameFields = typeof fields.fields;
interface Order {
	readonly id: number;
	readonly name: string;
}
const runtime = Atom.runtime(Layer.empty);

const mount = async (Component: () => null) => {
	const container = document.createElement("div");
	const root = createRoot(container);
	const registry = AtomRegistry.make();
	cleanups.push(async () => {
		await act(async () => root.unmount());
		registry.dispose();
	});
	await act(async () => root.render(createElement(RegistryContext.Provider, { value: registry }, createElement(Component))));
	return registry;
};

const creating = async () => {
	const names: string[] = [];
	const create = (values: { readonly name: string }) => Effect.sync((): Order => ({ id: names.push(values.name), name: values.name.trim() }));
	const held: { create?: Create<NameFields, Order, never, never>; submit?: Submit<Order, unknown> } = {};
	const registry = await mount(() => {
		const current = useCreate({ create, fields, initialValues: { name: "" }, runtime });
		held.create = current;
		held.submit = useSubmit(current.form);
		return null;
	});
	const current = () => {
		if (held.create === undefined || held.submit === undefined) {
			throw new Error("Create hook did not render");
		}
		return { create: held.create, submit: held.submit };
	};
	return { current, names, registry };
};

it("a create submitted through the form's own API records the result and resets the form", async () => {
	const { names, current } = await creating();
	current().create.form.change("name", "Desk lamps ");
	await act(async () => current().submit.run());
	expect(Option.getOrNull(current().create.created)).toEqual({ id: 1, name: "Desk lamps" });
	expect(current().create.form.values.value).toEqual({ name: "" });
	await act(async () => current().submit.run());
	expect(names).toEqual(["Desk lamps ", ""]);
});

it("a form-API create after an earlier save() compares against its own submission", async () => {
	const { registry, current } = await creating();
	current().create.form.change("name", "Desk lamps");
	await act(async () => current().create.save());
	current().create.form.change("name", "Office chairs");
	await act(async () => registry.set(current().create.form.submit, undefined));
	expect(Option.getOrNull(current().create.created)).toEqual({ id: 2, name: "Office chairs" });
	expect(current().create.form.values.value).toEqual({ name: "" });
});

it("an edit typed while an async schema decodes the submission survives the create reset", async () => {
	const decoding = Promise.withResolvers<void>();
	const decoded = (value: string) =>
		Effect.as(
			Effect.promise(() => decoding.promise),
			value,
		);
	const slow = Schema.Struct({
		name: Schema.String.pipe(
			Schema.decodeTo(Schema.String, {
				decode: SchemaGetter.transformOrFail(decoded),
				encode: SchemaGetter.transform((value: string) => value),
			}),
		),
	});
	const held: { create?: Create<typeof slow.fields, Order, never, never> } = {};
	await mount(() => {
		held.create = useCreate({ create: (values) => Effect.succeed({ id: 1, name: values.name }), fields: slow, initialValues: { name: "" }, runtime });
		return null;
	});
	const current = () => {
		if (held.create === undefined) {
			throw new Error("Create hook did not render");
		}
		return held.create;
	};
	await act(async () => current().form.change("name", "Desk lamps"));
	await act(async () => current().save());
	await act(async () => current().form.change("name", "Desk lamps and chairs"));
	await act(async () => decoding.resolve());
	await vi.waitFor(() => expect(Option.getOrNull(current().created)).toEqual({ id: 1, name: "Desk lamps" }));
	expect(current().form.values.value).toEqual({ name: "Desk lamps and chairs" });
});

it("an edit submitted through the form's own API receives the normalized saved row", async () => {
	const query = Atom.make(Effect.succeed<Order>({ id: 1, name: "desk lamps" }));
	const save = (values: { readonly name: string }) => Effect.succeed<Order>({ id: 1, name: values.name.toUpperCase() });
	const held: { editor?: Editor<NameFields, Order, never, never, never> } = {};
	const registry = await mount(() => {
		held.editor = useEditor({ fields, query, runtime, save, values: (row) => ({ name: row.name }) });
		return null;
	});
	const form = held.editor?.form;
	if (form === undefined) {
		throw new Error("Editor form did not load");
	}
	form.change("name", "toner");
	await act(async () => registry.set(form.submit, undefined));
	expect(form.values.value).toEqual({ name: "TONER" });
	expect(registry.get(form.dirty)).toBe(false);
});
