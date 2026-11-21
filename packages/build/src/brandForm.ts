import ts from "typescript";
import { byText } from "#byText.ts";
import type { WireForm } from "#facts.ts";
import { declaredIn, type TypeReading, typeArguments } from "#typeReading.ts";

export function isBranded(type: ts.Type): type is ts.IntersectionType {
	return type.isIntersection() && type.types.some((member) => !(member.flags & ts.TypeFlags.Object));
}

function brandName(reading: TypeReading, type: ts.IntersectionType): string {
	const keys = type.types
		.filter((member) => member.getSymbol()?.name === "Brand" && declaredIn(member, "Brand"))
		.flatMap((member) => typeArguments(reading.checker, member))
		.flatMap((key) => (key.isUnion() ? key.types : [key]))
		.flatMap((key) => (key.isStringLiteral() ? [key.value] : []));
	return keys.length === 0 ? reading.checker.typeToString(type) : [...new Set(keys)].sort(byText).join(" & ");
}

// A brand travels as the one schema the application exports for it, which checks the brand again when the browser decodes it.
export function brandForm(reading: TypeReading, type: ts.IntersectionType, path: string): WireForm | undefined {
	const schemas = [...reading.schemasOf(type)].sort((left, right) => byText(`${left.file} ${left.className}`, `${right.file} ${right.className}`));
	const [only] = schemas;
	if (only !== undefined && schemas.length === 1) {
		return { declared: only, form: "exported" };
	}
	const name = brandName(reading, type);
	return reading.refuse(
		type,
		path,
		only === undefined
			? `export one schema for the brand ${name}, built with Schema.brand("${name}"), from a module the operation imports`
			: `export one schema for the brand ${name}, not ${schemas.length}: ${schemas.map((schema) => `${schema.className} in ${schema.file}`).join(" and ")}`,
	);
}
