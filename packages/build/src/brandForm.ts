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

function writtenKeys(reading: TypeReading, type: ts.Type): readonly ts.Type[] {
	return (type.getSymbol()?.declarations ?? []).flatMap((declaration) =>
		ts.isMappedTypeNode(declaration) && declaration.typeParameter.constraint !== undefined
			? [reading.checker.getTypeFromTypeNode(declaration.typeParameter.constraint)]
			: [],
	);
}

const BRANDED_LITERAL_KEYS =
	"key the record by string or a string brand, or return an array of entries, since TypeScript keeps no property for a branded literal key and the wire would drop it";
const TYPE_PARAMETER_KEYS =
	"return a record keyed by string or a string brand, or an array of entries, since a mapped type whose keys come through a type parameter and that ends with no properties may have dropped branded literal keys, and write {} for an object meant to be empty";

// TypeScript makes neither a property nor an index signature of a branded literal key, so a Record or mapped type over one loses that key.
// The public API has no getter for a mapped type's keys, so they are read from what its declaration writes after `in`; keys written
// through a type parameter read as that parameter, so such a type that ends empty is refused unless it is a Record whose arguments say why.
export function droppedKeysFix(reading: TypeReading, type: ts.Type): string | undefined {
	const keys = writtenKeys(reading, type);
	if (keys.some(hasBrandedLiteral)) {
		return BRANDED_LITERAL_KEYS;
	}
	const [argument] = type.aliasTypeArguments ?? [];
	if (isLibraryAlias(reading, type, RECORD)) {
		return argument !== undefined && hasBrandedLiteral(argument) ? BRANDED_LITERAL_KEYS : undefined;
	}
	if (
		keys.some((key) => key.flags & ts.TypeFlags.TypeParameter)
		&& reading.checker.getPropertiesOfType(type).length === 0
		&& reading.checker.getIndexInfosOfType(type).length === 0
	) {
		return TYPE_PARAMETER_KEYS;
	}
	return argument !== undefined && isLibraryAlias(reading, type, HOMOMORPHIC) ? droppedKeysFix(reading, argument) : undefined;
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
