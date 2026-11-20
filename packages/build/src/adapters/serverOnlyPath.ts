import ts from "typescript";
import { declaredIn, typeArguments } from "#adapters/typeReading.ts";

export function isRedacted(type: ts.Type): boolean {
	return type.getSymbol()?.name === "Redacted" && declaredIn(type, "Redacted");
}

// A Schema class travels by name, so the wire never reads its fields; this finds a Redacted among them, at any depth.
export function redactedPath(checker: ts.TypeChecker, type: ts.Type, path: string, seen: ReadonlySet<ts.Type> = new Set()): string | undefined {
	if (seen.has(type)) {
		return undefined;
	}
	const within = new Set([...seen, type]);
	if (isRedacted(type)) {
		return path;
	}
	if (type.isUnionOrIntersection()) {
		return type.types.map((member) => redactedPath(checker, member, path, within)).find((found) => found !== undefined);
	}
	if (!(type.flags & ts.TypeFlags.Object)) {
		return undefined;
	}
	if (checker.isArrayType(type) || checker.isTupleType(type)) {
		const label = checker.isArrayType(type) ? () => "[number]" : (index: number) => `[${index}]`;
		return typeArguments(checker, type)
			.map((element, index) => redactedPath(checker, element, `${path}${label(index)}`, within))
			.find((found) => found !== undefined);
	}
	const fields = checker
		.getPropertiesOfType(type)
		.filter((property) => !property.name.startsWith("__@"))
		.map((property) => [property.name, checker.getTypeOfSymbol(property)] as const)
		.filter(([, field]) => field.getCallSignatures().length === 0);
	const indexes = checker.getIndexInfosOfType(type).map((index) => [`[${checker.typeToString(index.keyType)}]`, index.type] as const);
	return [...fields.map(([name, field]) => [`.${name}`, field] as const), ...indexes]
		.map(([step, field]) => redactedPath(checker, field, `${path}${step}`, within))
		.find((found) => found !== undefined);
}
