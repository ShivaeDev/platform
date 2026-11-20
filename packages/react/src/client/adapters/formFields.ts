import { Schema } from "effect";
import type { Fields } from "@shivaedev/form/shape.ts";

const derived = new WeakMap<Schema.Top, Map<string, Schema.Struct<Fields>>>();

function isStruct(schema: unknown): schema is Schema.Struct<Fields> {
	return Schema.isSchema(schema) && schema.ast._tag === "Objects" && "fields" in schema;
}

// The same payload and fixed keys give the same struct, so a form is not rebuilt because a screen passed a new `fixed` object.
export function formFields(payload: unknown, fields: Schema.Struct<Fields> | undefined, fixed: object | undefined): Schema.Struct<Fields> {
	if (fields !== undefined) {
		return fields;
	}
	if (!isStruct(payload)) {
		// The hook types already require `fields` here; an untyped caller learns of it during render, the way React reports a hook's misuse.
		throw new Error("This command's payload is not a struct, so pass the form's `fields`");
	}
	const fixedKeys = Object.keys(fixed ?? {});
	if (fixedKeys.length === 0) {
		return payload;
	}
	const key = fixedKeys.sort((left, right) => left.localeCompare(right)).join("\u0000");
	const byKeys = derived.get(payload) ?? new Map<string, Schema.Struct<Fields>>();
	derived.set(payload, byKeys);
	const existing = byKeys.get(key);
	if (existing !== undefined) {
		return existing;
	}
	const Omitted = Schema.Struct(Object.fromEntries(Object.entries(payload.fields).filter(([name]) => !fixedKeys.includes(name))));
	byKeys.set(key, Omitted);
	return Omitted;
}
