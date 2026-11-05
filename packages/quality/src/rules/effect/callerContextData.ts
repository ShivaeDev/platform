import ts from "typescript";

const CALLERS = new Set(["SessionUser", "Subject", "Identity", "SessionUserWithProviderAccounts"]);

function data(checker: ts.TypeChecker, value: ts.Type, seen: Set<ts.Type>): boolean {
	if (seen.has(value)) {
		return true;
	}
	seen.add(value);
	if (value.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
		return false;
	}
	if (
		value.flags
		& (ts.TypeFlags.StringLike
			| ts.TypeFlags.NumberLike
			| ts.TypeFlags.BooleanLike
			| ts.TypeFlags.ESSymbolLike
			| ts.TypeFlags.BigIntLike
			| ts.TypeFlags.Null
			| ts.TypeFlags.Undefined
			| ts.TypeFlags.Never)
	) {
		return true;
	}
	if (value.isUnionOrIntersection()) {
		return value.types.every((part) => data(checker, part, seen));
	}
	if (value.getProperty("~effect/Context/Service") !== undefined || value.getProperty("~effect/Context") !== undefined) {
		return false;
	}
	if (value.getProperty("~effect/Effect") !== undefined) {
		return true;
	}
	if (value.getCallSignatures().length > 0 || value.getConstructSignatures().length > 0) {
		return false;
	}
	const element = checker.getIndexTypeOfType(value, ts.IndexKind.Number);
	return element === undefined
		? value.getProperties().every((property) => data(checker, checker.getTypeOfSymbol(property), seen))
		: data(checker, element, seen);
}

export function callerContextData(checker: ts.TypeChecker, type: ts.Type, name: string): boolean {
	return CALLERS.has(name) && data(checker, type, new Set());
}
