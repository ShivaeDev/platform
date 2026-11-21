import ts from "typescript";
import { byText } from "#byText.ts";
import type { WireForm } from "#facts.ts";
import { declaredIn, type TypeReading, typeArguments } from "#typeReading.ts";

export function isBranded(type: ts.Type): type is ts.IntersectionType {
	return type.isIntersection() && type.types.some((member) => !(member.flags & ts.TypeFlags.Object));
}

const RECORD = new Set(["Record"]);
const HOMOMORPHIC = new Set(["Partial", "Readonly", "Required"]);

function isLibraryAlias(reading: TypeReading, type: ts.Type, names: ReadonlySet<string>): boolean {
	const alias = type.aliasSymbol;
	return (
		alias !== undefined
		&& names.has(alias.name)
		&& alias.declarations?.some((declaration) => reading.program.isSourceFileDefaultLibrary(declaration.getSourceFile())) === true
	);
}

function hasBrandedLiteral(keys: ts.Type): boolean {
	return (keys.isUnion() ? keys.types : [keys]).some(
		(key) => key.isIntersection() && key.types.some((member) => member.flags & (ts.TypeFlags.StringLiteral | ts.TypeFlags.NumberLiteral)),
	);
}

function writesBrandedLiteralKeys(reading: TypeReading, type: ts.Type): boolean {
	return (
		type
			.getSymbol()
			?.declarations?.some(
				(declaration) =>
					ts.isMappedTypeNode(declaration)
					&& declaration.typeParameter.constraint !== undefined
					&& hasBrandedLiteral(reading.checker.getTypeFromTypeNode(declaration.typeParameter.constraint)),
			) === true
	);
}

// TypeScript makes neither a property nor an index signature of a branded literal key, so a Record or mapped type over one loses that key.
// The public API has no getter for a mapped type's keys, so they are read from what its declaration writes after `in`; keys written
// through a type parameter, as Record and Partial write theirs, read as that parameter and are left to the alias checks.
export function dropsBrandedLiteralKeys(reading: TypeReading, type: ts.Type): boolean {
	if (writesBrandedLiteralKeys(reading, type)) {
		return true;
	}
	const [argument] = type.aliasTypeArguments ?? [];
	if (argument === undefined) {
		return false;
	}
	if (isLibraryAlias(reading, type, HOMOMORPHIC)) {
		return dropsBrandedLiteralKeys(reading, argument);
	}
	return isLibraryAlias(reading, type, RECORD) && hasBrandedLiteral(argument);
}

export function isStringBrand(type: ts.IntersectionType): boolean {
	return type.types.some((member) => member.flags & ts.TypeFlags.StringLike);
}

function brandName(reading: TypeReading, type: ts.IntersectionType): string | undefined {
	const keys = type.types
		.filter((member) => member.getSymbol()?.name === "Brand" && declaredIn(member, "Brand"))
		.flatMap((member) => typeArguments(reading.checker, member))
		.flatMap((key) => (key.isUnion() ? key.types : [key]))
		.flatMap((key) => (key.isStringLiteral() ? [key.value] : []));
	return keys.length === 0 ? undefined : [...new Set(keys)].sort(byText).join(" & ");
}

// A brand travels as the one schema the application exports for it, which checks the brand again when the browser decodes it.
export function brandForm(reading: TypeReading, type: ts.IntersectionType, path: string): WireForm | undefined {
	const schemas = [...reading.schemasOf(type)].sort((left, right) => byText(`${left.file} ${left.className}`, `${right.file} ${right.className}`));
	const [only] = schemas;
	if (only !== undefined && schemas.length === 1) {
		return { declared: only, form: "exported" };
	}
	const name = brandName(reading, type);
	if (only !== undefined) {
		const listed = schemas.map((schema) => `${schema.className} in ${schema.file}`).join(" and ");
		return reading.refuse(
			type,
			path,
			`export one schema for the brand ${name ?? reading.checker.typeToString(type)}, not ${schemas.length}: ${listed}`,
		);
	}
	return reading.refuse(
		type,
		path,
		name === undefined
			? "return the unbranded type, or build the brand with Schema.brand and export its schema from a module the operation imports"
			: `export one schema for the brand ${name}, built with Schema.brand("${name}"), from a module the operation imports`,
	);
}
