import { type Code, code, type ImportRef, joined, SCHEMA } from "#code.ts";
import type { Field, WireForm } from "#facts.ts";

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/u;

function schema(member: string, ...inner: readonly (string | ImportRef | Code)[]): Code {
	return inner.length === 0 ? code(SCHEMA, `.${member}`) : code(SCHEMA, `.${member}(`, ...inner, ")");
}

function mutableWhen(mutable: boolean, inner: Code): Code {
	return mutable ? schema("mutable", inner) : inner;
}

function fieldCode(field: Field, classRef: (form: Extract<WireForm, { form: "class" }>) => ImportRef): Code {
	const value = formCode(field.form, classRef);
	const optional = field.optional ? schema("optionalKey", value) : value;
	const key = IDENTIFIER.test(field.name) ? field.name : JSON.stringify(field.name);
	return code(`${key}: `, field.mutable ? schema("mutableKey", optional) : optional);
}

export function formCode(form: WireForm, classRef: (form: Extract<WireForm, { form: "class" }>) => ImportRef): Code {
	function inner(each: WireForm) {
		return formCode(each, classRef);
	}
	switch (form.form) {
		case "primitive":
			return schema(form.primitive);
		case "literals":
			return form.values.length === 1
				? schema("Literal", JSON.stringify(form.values[0]))
				: schema("Literals", `[${form.values.map((value) => JSON.stringify(value)).join(", ")}]`);
		case "array":
			return mutableWhen(form.mutable, schema("Array", inner(form.item)));
		case "tuple":
			return mutableWhen(form.mutable, schema("Tuple", "[", joined(form.elements.map(inner), ", "), "]"));
		case "struct":
			return form.fields.length === 0
				? schema("Struct", "{}")
				: schema(
						"Struct",
						"{ ",
						joined(
							form.fields.map((field) => fieldCode(field, classRef)),
							", ",
						),
						" }",
					);
		case "record":
			return schema("Record", schema("String"), ", ", form.mutable ? schema("mutableKey", inner(form.value)) : inner(form.value));
		case "union":
			return schema("Union", "[", joined(form.members.map(inner), ", "), "]");
		case "nullOr":
			return schema("NullOr", inner(form.inner));
		case "option":
			return schema("Option", inner(form.inner));
		case "class":
			return code(classRef(form));
	}
}
