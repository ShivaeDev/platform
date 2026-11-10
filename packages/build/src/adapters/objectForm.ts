import ts from "typescript";
import { declaredClass, isSchemaClass, type TypeReading } from "#adapters/typeReading.ts";
import { isReadonlyProperty } from "#adapters/typeScriptInternals.ts";
import type { Field, WireForm } from "#facts.ts";

type Read = (type: ts.Type, path: string) => WireForm | undefined;

export function classForm(reading: TypeReading, type: ts.Type, symbol: ts.Symbol, path: string): WireForm | undefined {
	if (!isSchemaClass(reading, symbol)) {
		return reading.refuse(type, path, "return a plain object, or make the class a Schema class");
	}
	const declared = declaredClass(reading, symbol);
	if (declared?.exportName === undefined) {
		return reading.refuse(type, path, `export the Schema class ${symbol.name} from its module`);
	}
	return { declared, form: "class" };
}

function withoutUndefined(type: ts.Type): ts.Type {
	if (!type.isUnion()) {
		return type;
	}
	const kept = type.types.filter((member) => !(member.flags & ts.TypeFlags.Undefined));
	return kept.length === 1 && kept[0] !== undefined ? kept[0] : type;
}

function fieldOf(reading: TypeReading, property: ts.Symbol, exact: ReadonlySet<ts.Symbol>, path: string, read: Read): Field | undefined {
	const optional = (property.flags & ts.SymbolFlags.Optional) !== 0;
	const type = reading.checker.getTypeOfSymbol(property);
	if (optional && !exact.has(property)) {
		return reading.refuse(type, path, `drop undefined from the optional property ${property.name}, so an absent key is the only way to leave it out`);
	}
	const form = read(optional ? withoutUndefined(type) : type, path);
	return form === undefined ? undefined : { form, mutable: !isReadonlyProperty(property), name: property.name, optional };
}

function recordForm(reading: TypeReading, type: ts.Type, path: string, read: Read): WireForm | undefined {
	const [index, ...others] = reading.checker.getIndexInfosOfType(type);
	if (index === undefined || others.length > 0 || !(index.keyType.flags & ts.TypeFlags.String)) {
		return reading.refuse(type, path, "use string keys only");
	}
	const value = read(index.type, `${path}[string]`);
	return value === undefined ? undefined : { form: "record", mutable: !index.isReadonly, value };
}

export function objectForm(reading: TypeReading, type: ts.Type, path: string, read: Read): WireForm | undefined {
	if (type.getCallSignatures().length > 0 || type.getConstructSignatures().length > 0) {
		return reading.refuse(type, path, "return data, not a function");
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
