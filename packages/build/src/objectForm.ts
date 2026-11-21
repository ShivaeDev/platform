import ts from "typescript";
import { brandForm, droppedKeysFix, isBranded, isStringBrand } from "#brandForm.ts";
import type { Field, WireForm } from "#facts.ts";
import { isReadonlyProperty } from "#isReadonlyProperty.ts";
import { redactedPath } from "#serverOnlyPath.ts";
import { declaredClass, isSchemaClass, type TypeReading } from "#typeReading.ts";
import { unionForm } from "#unionForm.ts";

type Read = (type: ts.Type, path: string) => WireForm | undefined;

export function classForm(reading: TypeReading, type: ts.Type, symbol: ts.Symbol, path: string): WireForm | undefined {
	if (!isSchemaClass(reading, symbol)) {
		return reading.refuse(type, path, "return a plain object, or make the class a Schema class");
	}
	const redacted = redactedPath(reading.checker, type, path);
	if (redacted !== undefined) {
		return reading.refuseServerOnly(redacted, symbol.name);
	}
	const declared = declaredClass(reading, symbol);
	if (declared?.exportName === undefined) {
		return reading.refuse(type, path, `export the Schema class ${symbol.name} from its module`);
	}
	return { declared, form: "exported" };
}

// An exact optional property's only undefined member is the one optionality adds: TypeScript merges a written undefined
// into it, and the property is then not exact.
function optionalForm(reading: TypeReading, type: ts.Type, path: string, read: Read): WireForm | undefined {
	const members = type.isUnion() ? type.types.filter((member) => !(member.flags & ts.TypeFlags.Undefined)) : [type];
	const [only] = members;
	if (only === undefined) {
		return reading.refuse(type, path, "give the optional property a type besides undefined, or drop it");
	}
	return members.length === 1 ? read(only, path) : unionForm(reading, type, members, path, read);
}

function fieldOf(reading: TypeReading, property: ts.Symbol, exact: ReadonlySet<ts.Symbol>, path: string, read: Read): Field | undefined {
	const optional = (property.flags & ts.SymbolFlags.Optional) !== 0;
	const type = reading.checker.getTypeOfSymbol(property);
	if (optional && !exact.has(property)) {
		return reading.refuse(type, path, `drop undefined from the optional property ${property.name}, so an absent key is the only way to leave it out`);
	}
	const form = optional ? optionalForm(reading, type, path, read) : read(type, path);
	return form === undefined ? undefined : { form, mutable: !isReadonlyProperty(property), name: property.name, optional };
}

function recordForm(reading: TypeReading, type: ts.Type, path: string, read: Read): WireForm | undefined {
	const [index, ...others] = reading.checker.getIndexInfosOfType(type);
	const keyType = index?.keyType;
	if (index === undefined || keyType === undefined || others.length > 0 || !(keyType.flags & ts.TypeFlags.String || isBranded(keyType))) {
		return reading.refuse(type, path, "use string keys, or keys of a branded string");
	}
	if (index.type.isUnion() && index.type.types.some((member) => member.flags & ts.TypeFlags.Undefined)) {
		return reading.refuse(type, path, "drop Partial and undefined from the record's values, so an absent key is the only way to leave a value out");
	}
	if (isBranded(keyType) && !isStringBrand(keyType)) {
		return reading.refuse(
			type,
			path,
			"key the record by string or a string brand, or return an array of entries, since JSON keys are strings and the wire cannot check them against a brand that is not a string",
		);
	}
	const keyName = reading.checker.typeToString(keyType);
	const key: WireForm | undefined = isBranded(keyType)
		? brandForm(reading, keyType, `${path}[${keyName}]`)
		: { form: "primitive", primitive: "String" };
	const value = read(index.type, `${path}[${keyName}]`);
	return key === undefined || value === undefined ? undefined : { form: "record", key, mutable: !index.isReadonly, value };
}

export function objectForm(reading: TypeReading, type: ts.Type, path: string, read: Read): WireForm | undefined {
	if (type.getCallSignatures().length > 0 || type.getConstructSignatures().length > 0) {
		return reading.refuse(type, path, "return data, not a function");
	}
	const droppedKeys = droppedKeysFix(reading, type);
	if (droppedKeys !== undefined) {
		return reading.refuse(type, path, droppedKeys);
	}
	const symbol = type.getSymbol();
	const builtIn =
		symbol !== undefined
		&& symbol.flags & ts.SymbolFlags.Interface
		&& symbol.declarations?.some((declaration) => reading.program.isSourceFileDefaultLibrary(declaration.getSourceFile()));
	if (builtIn === true) {
		return reading.refuse(type, path, "return a plain object, an array or a string-keyed record");
	}
	const properties = reading.checker.getPropertiesOfType(type);
	const indexes = reading.checker.getIndexInfosOfType(type);
	if (indexes.length > 0) {
		return properties.length === 0 ? recordForm(reading, type, path, read) : reading.refuse(type, path, "use either fixed properties or a record");
	}
	const methods = properties.filter((property) => reading.checker.getTypeOfSymbol(property).getCallSignatures().length > 0);
	if (methods.length > 0 || properties.some((property) => property.name.startsWith("__@"))) {
		return reading.refuse(type, path, "return plain data, without methods or symbol keys");
	}
	const exact = new Set(reading.checker.getExactOptionalProperties(type));
	const fields = properties.map((property) => fieldOf(reading, property, exact, `${path}.${property.name}`, read));
	return fields.every((field) => field !== undefined) ? { fields, form: "struct" } : undefined;
}
