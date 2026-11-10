import ts from "typescript";
import { classForm, objectForm } from "#adapters/objectForm.ts";
import { declaredIn, isLibraryType, isReference, type TypeReading, typeArguments } from "#adapters/typeReading.ts";
import { unionForm } from "#adapters/unionForm.ts";
import type { Primitive, WireForm } from "#facts.ts";

const PRIMITIVES: readonly (readonly [ts.TypeFlags, Primitive])[] = [
	[ts.TypeFlags.String, "String"],
	[ts.TypeFlags.Number, "Number"],
	[ts.TypeFlags.Boolean, "Boolean"],
	[ts.TypeFlags.BigInt, "BigInt"],
	[ts.TypeFlags.Null, "Null"],
	[ts.TypeFlags.Void, "Void"],
	[ts.TypeFlags.Undefined, "Undefined"],
];

const UNMAPPED: readonly (readonly [ts.TypeFlags, string])[] = [
	[ts.TypeFlags.Any, "decode the value with a schema, or give it a type"],
	[ts.TypeFlags.Unknown, "decode the value with a schema, or give it a type"],
	[ts.TypeFlags.Never, "return a value, or nothing"],
	[ts.TypeFlags.EnumLike, "return string or number literals instead of an enum"],
	[ts.TypeFlags.BooleanLiteral, "return boolean"],
	[ts.TypeFlags.TemplateLiteral | ts.TypeFlags.StringMapping, "return string"],
	[ts.TypeFlags.ESSymbolLike, "return a string instead of a symbol"],
	[ts.TypeFlags.TypeParameter | ts.TypeFlags.Index | ts.TypeFlags.IndexedAccess | ts.TypeFlags.Conditional, "give run's return a concrete type"],
	[ts.TypeFlags.NonPrimitive, "return a type with known properties"],
];

function arrayForm(reading: TypeReading, type: ts.Type, path: string, seen: ReadonlySet<ts.Type>): WireForm | undefined {
	const [element] = typeArguments(reading.checker, type);
	const item = element === undefined ? undefined : wireForm(reading, element, `${path}[number]`, seen);
	return item === undefined ? undefined : { form: "array", item, mutable: type.getSymbol()?.name === "Array" };
}

function isTuple(target: ts.GenericType): target is ts.TupleType {
	return "elementFlags" in target;
}

function tupleForm(reading: TypeReading, type: ts.TypeReference, path: string, seen: ReadonlySet<ts.Type>): WireForm | undefined {
	const target = type.target;
	if (!isTuple(target) || target.elementFlags.some((flags) => flags !== ts.ElementFlags.Required)) {
		return reading.refuse(type, path, "use an array, or a tuple of required elements");
	}
	const elements = reading.checker
		.getTypeArguments(type)
		.slice(0, target.elementFlags.length)
		.map((element, index) => wireForm(reading, element, `${path}[${index}]`, seen));
	return elements.every((element) => element !== undefined) ? { elements, form: "tuple", mutable: !target.readonly } : undefined;
}

function objectTypeForm(reading: TypeReading, type: ts.Type, path: string, seen: ReadonlySet<ts.Type>): WireForm | undefined {
	if (isLibraryType(reading, type, "Date")) {
		return { form: "primitive", primitive: "Date" };
	}
	if (declaredIn(type, "DateTime") && type.getSymbol()?.name === "Utc") {
		return { form: "primitive", primitive: "DateTimeUtc" };
	}
	if (reading.checker.isTupleType(type) && isReference(type)) {
		return tupleForm(reading, type, path, seen);
	}
	if (reading.checker.isArrayType(type)) {
		return arrayForm(reading, type, path, seen);
	}
	const symbol = type.getSymbol();
	if (symbol !== undefined && symbol.flags & ts.SymbolFlags.Class) {
		return classForm(reading, type, symbol, path);
	}
	return objectForm(reading, type, path, (property, propertyPath) => wireForm(reading, property, propertyPath, seen));
}

// The schema whose Type is exactly this type, or undefined after refusing it: the wire never carries a looser form.
export function wireForm(reading: TypeReading, type: ts.Type, path: string, seen: ReadonlySet<ts.Type> = new Set()): WireForm | undefined {
	if (seen.has(type)) {
		return reading.refuse(type, path, "return a type that does not contain itself");
	}
	const within = new Set([...seen, type]);
	const primitive = PRIMITIVES.find(([flags]) => type.flags & flags);
	if (primitive !== undefined) {
		return { form: "primitive", primitive: primitive[1] };
	}
	const unmapped = UNMAPPED.find(([flags]) => type.flags & flags);
	if (unmapped !== undefined) {
		return reading.refuse(type, path, unmapped[1]);
	}
	if (type.isStringLiteral() || type.isNumberLiteral()) {
		return { form: "literals", values: [type.value] };
	}
	if (type.isUnion()) {
		return unionForm(reading, type, type.types, path, (member, memberPath) => wireForm(reading, member, memberPath, within));
	}
	if (type.isIntersection() && type.types.some((member) => !(member.flags & ts.TypeFlags.Object))) {
		return reading.refuse(type, path, "return the unbranded type, or wrap the value in an exported Schema class");
	}
	if (type.flags & ts.TypeFlags.Object || type.isIntersection()) {
		return objectTypeForm(reading, type, path, within);
	}
	return reading.refuse(type, path, "return plain data");
}
