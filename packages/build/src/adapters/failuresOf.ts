import ts from "typescript";
import { declaredClass, type TypeReading } from "#adapters/typeReading.ts";
import type { Failure } from "#facts.ts";

function failureOf(reading: TypeReading, member: ts.Type): Failure | undefined {
	if (member.flags & ts.TypeFlags.Never) {
		return undefined;
	}
	if (member.getProperty("isRetryable") !== undefined) {
		return { kind: "retryable" };
	}
	const text = reading.checker.typeToString(member);
	const tagProperty = member.getProperty("_tag");
	const tag = tagProperty === undefined ? undefined : reading.checker.getTypeOfSymbol(tagProperty);
	if (tag === undefined || !tag.isStringLiteral()) {
		return { kind: "untagged", text };
	}
	// Object.assign(new NoteChanged(...), { cause }) raises a NoteChanged whose type is an intersection.
	const parts = member.isIntersection() ? member.types : [member];
	const symbol = parts.map((part) => part.getSymbol()).find((candidate) => candidate !== undefined && candidate.flags & ts.SymbolFlags.Class);
	const declared = symbol === undefined ? undefined : declaredClass(reading, symbol);
	return declared?.exportName === undefined ? { kind: "unexported", tag: tag.value, text } : { declared, kind: "class", tag: tag.value };
}

// A rejection is the class run raises, so each failure keeps the declaration it came from, never just its shape.
export function failuresOf(reading: TypeReading, errors: readonly ts.Type[]): readonly Failure[] {
	return errors.flatMap((error) => (error.isUnion() ? error.types : [error])).flatMap((member) => failureOf(reading, member) ?? []);
}
