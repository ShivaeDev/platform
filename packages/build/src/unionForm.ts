import ts from "typescript";
import { byText } from "#byText.ts";
import type { Literal, WireForm } from "#facts.ts";
import { declaredIn, literalOf, type TypeReading } from "#typeReading.ts";

type Read = (type: ts.Type, path: string) => WireForm | undefined;

const MIXED = "return string, number or boolean literals, string or number with boolean, or objects told apart by one literal field such as _tag";

function discriminant(reading: TypeReading, members: readonly ts.Type[]): string | undefined {
	const [first] = members;
	const candidates = first === undefined ? [] : reading.checker.getPropertiesOfType(first).map((property) => property.name);
	return candidates.sort().find((name) => {
		const values = members.map((member) => {
			const property = member.getProperty(name);
			return property === undefined || property.flags & ts.SymbolFlags.Optional
				? undefined
				: literalOf(reading.checker, reading.checker.getTypeOfSymbol(property));
		});
		return values.every((value) => value !== undefined) && new Set(values).size === values.length;
	});
}

function byValue(left: Literal, right: Literal): number {
	return byText(String(left), String(right));
}

function discriminated(reading: TypeReading, members: readonly ts.Type[], tag: string, path: string, read: Read): WireForm | undefined {
	function tagOf(member: ts.Type) {
		const property = member.getProperty(tag);
		return (property === undefined ? undefined : literalOf(reading.checker, reading.checker.getTypeOfSymbol(property))) ?? "";
	}
	const forms = [...members]
		.sort((left, right) => byValue(tagOf(left), tagOf(right)))
		.map((member) => read(member, `${path}<${tag}: ${tagOf(member)}>`));
	return forms.every((form) => form !== undefined) ? { form: "union", members: forms } : undefined;
}

function optionValue(reading: TypeReading, members: readonly ts.Type[]): ts.Type | undefined {
	const some = members.find((member) => member.getSymbol()?.name === "Some" && declaredIn(member, "Option"));
	const none = members.find((member) => member.getSymbol()?.name === "None" && declaredIn(member, "Option"));
	const value = some?.getProperty("value");
	return none === undefined || value === undefined ? undefined : reading.checker.getTypeOfSymbol(value);
}

const JSON_MEMBERS = ["JsonArray", "JsonObject", "Number", "String", "false", "null", "true"];

function jsonMember(reading: TypeReading, member: ts.Type): string | undefined {
	if (member.flags & ts.TypeFlags.Null) {
		return "null";
	}
	if (member.flags & (ts.TypeFlags.String | ts.TypeFlags.Number)) {
		return member.flags & ts.TypeFlags.String ? "String" : "Number";
	}
	if (member.flags & ts.TypeFlags.BooleanLiteral) {
		return String(literalOf(reading.checker, member));
	}
	const name = member.getSymbol()?.name;
	return (name === "JsonArray" || name === "JsonObject") && declaredIn(member, "Schema") ? name : undefined;
}

// Effect's Json, also when an optional property's undefined is taken off it and it is no longer the alias.
function isJson(reading: TypeReading, members: readonly ts.Type[]): boolean {
	const names = members.map((member) => jsonMember(reading, member));
	return names.length === JSON_MEMBERS.length && JSON_MEMBERS.every((name) => names.includes(name));
}

function primitiveUnion(reading: TypeReading, type: ts.Type, members: readonly ts.Type[], path: string): WireForm | undefined {
	const booleans = members.filter((member) => member.flags & ts.TypeFlags.BooleanLiteral);
	const others = members.filter((member) => !(member.flags & ts.TypeFlags.BooleanLiteral));
	const [other] = others;
	if (
		others.some((member) => member.flags & (ts.TypeFlags.BigInt | ts.TypeFlags.Number))
		&& others.some((member) => member.flags & ts.TypeFlags.String)
	) {
		return reading.refuse(
			type,
			path,
			"return string or number, alone or with boolean, since a NaN or infinite number and a bigint travel as strings and a union with string cannot tell them apart",
		);
	}
	if (other === undefined || others.length > 1 || !(other.flags & (ts.TypeFlags.String | ts.TypeFlags.Number)) || booleans.length === 0) {
		return reading.refuse(type, path, MIXED);
	}
	const values = booleans.map((member) => literalOf(reading.checker, member) ?? false);
	return {
		form: "union",
		members: [
			{ form: "primitive", primitive: other.flags & ts.TypeFlags.String ? "String" : "Number" },
			values.length === 2 ? { form: "primitive", primitive: "Boolean" } : { form: "literals", values },
		],
	};
}

function withoutNull(reading: TypeReading, type: ts.Type, all: readonly ts.Type[], path: string, read: Read): WireForm | undefined {
	const members = all.filter((member) => !(member.flags & ts.TypeFlags.Null));
	const [only] = members;
	if (members.length === 1 && only !== undefined && only.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Void)) {
		return reading.refuse(type, path, "return either null or undefined, since the wire carries both as one");
	}
	const booleans = members.filter((member) => member.flags & ts.TypeFlags.BooleanLiteral);
	const optionInner = optionValue(reading, members);
	if (optionInner !== undefined && members.length === 2) {
		const inner = read(optionInner, `${path}<Some>`);
		return inner === undefined ? undefined : { form: "option", inner };
	}
	if (booleans.length === 2 && members.length === 2) {
		return { form: "primitive", primitive: "Boolean" };
	}
	if (members.length === 1 && only !== undefined) {
		return read(only, path);
	}
	if (members.some((member) => member.flags & ts.TypeFlags.Undefined)) {
		return reading.refuse(type, path, "return null instead of undefined, or make the property optional");
	}
	const values = members.map((member) => literalOf(reading.checker, member));
	if (values.every((value) => value !== undefined)) {
		return { form: "literals", values: values.sort(byValue) };
	}
	const primitives = members.every(
		(member) => member.flags & (ts.TypeFlags.String | ts.TypeFlags.Number | ts.TypeFlags.BigInt | ts.TypeFlags.BooleanLiteral),
	);
	if (primitives) {
		return primitiveUnion(reading, type, members, path);
	}
	const objects = members.every(
		(member) => member.flags & ts.TypeFlags.Object && !reading.checker.isArrayType(member) && !reading.checker.isTupleType(member),
	);
	const tag = objects ? discriminant(reading, members) : undefined;
	if (tag !== undefined) {
		return discriminated(reading, members, tag, path, read);
	}
	return reading.refuse(type, path, MIXED);
}

// The members are the union's own, or an optional property's without the undefined its optionality adds.
export function unionForm(reading: TypeReading, type: ts.Type, members: readonly ts.Type[], path: string, read: Read): WireForm | undefined {
	if (type.aliasSymbol?.name === "Option" && declaredIn(type, "Option") && type.aliasTypeArguments?.[0] !== undefined) {
		const inner = read(type.aliasTypeArguments[0], `${path}<Some>`);
		return inner === undefined ? undefined : { form: "option", inner };
	}
	if (isJson(reading, members)) {
		return { form: "primitive", primitive: "Json" };
	}
	const inner = withoutNull(reading, type, members, path, read);
	const nullable = members.some((member) => member.flags & ts.TypeFlags.Null);
	return inner === undefined || !nullable ? inner : { form: "nullOr", inner };
}
