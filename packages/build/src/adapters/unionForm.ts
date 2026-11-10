import ts from "typescript";
import { declaredIn, literalOf, type TypeReading } from "#adapters/typeReading.ts";
import { byText } from "#byText.ts";
import type { WireForm } from "#facts.ts";

type Read = (type: ts.Type, path: string) => WireForm | undefined;

function discriminant(reading: TypeReading, members: readonly ts.Type[]): string | undefined {
	const [first] = members;
	const candidates = first === undefined ? [] : reading.checker.getPropertiesOfType(first).map((property) => property.name);
	return candidates.sort().find((name) => {
		const values = members.map((member) => {
			const property = member.getProperty(name);
			return property === undefined || property.flags & ts.SymbolFlags.Optional ? undefined : literalOf(reading.checker.getTypeOfSymbol(property));
		});
		return values.every((value) => value !== undefined) && new Set(values).size === values.length;
	});
}

function byValue(left: string | number, right: string | number): number {
	return byText(String(left), String(right));
}

function discriminated(reading: TypeReading, members: readonly ts.Type[], tag: string, path: string, read: Read): WireForm | undefined {
	function tagOf(member: ts.Type) {
		const property = member.getProperty(tag);
		return (property === undefined ? undefined : literalOf(reading.checker.getTypeOfSymbol(property))) ?? "";
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

function withoutNull(reading: TypeReading, type: ts.UnionType, path: string, read: Read): WireForm | undefined {
	const members = type.types.filter((member) => !(member.flags & ts.TypeFlags.Null));
	const booleans = members.filter((member) => member.flags & ts.TypeFlags.BooleanLiteral);
	const optionInner = optionValue(reading, members);
	if (optionInner !== undefined && members.length === 2) {
		const inner = read(optionInner, `${path}<Some>`);
		return inner === undefined ? undefined : { form: "option", inner };
	}
	if (booleans.length === 2 && members.length === 2) {
		return { form: "primitive", primitive: "Boolean" };
	}
	if (members.length === 1 && members[0] !== undefined) {
		return read(members[0], path);
	}
	if (members.some((member) => member.flags & ts.TypeFlags.Undefined)) {
		return reading.refuse(type, path, "return null instead of undefined, or make the property optional");
	}
	const values = members.map(literalOf);
	if (values.every((value) => value !== undefined)) {
		return { form: "literals", values: values.sort(byValue) };
	}
	const objects = members.every(
		(member) => member.flags & ts.TypeFlags.Object && !reading.checker.isArrayType(member) && !reading.checker.isTupleType(member),
	);
	const tag = objects ? discriminant(reading, members) : undefined;
	if (tag !== undefined) {
		return discriminated(reading, members, tag, path, read);
	}
	return reading.refuse(type, path, "return string or number literals, or objects told apart by one literal field such as _tag");
}

export function unionForm(reading: TypeReading, type: ts.UnionType, path: string, read: Read): WireForm | undefined {
	if (type.aliasSymbol?.name === "Option" && declaredIn(type, "Option") && type.aliasTypeArguments?.[0] !== undefined) {
		const inner = read(type.aliasTypeArguments[0], `${path}<Some>`);
		return inner === undefined ? undefined : { form: "option", inner };
	}
	const inner = withoutNull(reading, type, path, read);
	const nullable = type.types.some((member) => member.flags & ts.TypeFlags.Null);
	return inner === undefined || !nullable ? inner : { form: "nullOr", inner };
}
