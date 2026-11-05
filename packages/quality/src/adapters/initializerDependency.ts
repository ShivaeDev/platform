import ts from "typescript";
import { effectSuccess } from "#adapters/serviceModelSyntax.ts";

const DATA =
	ts.TypeFlags.StringLike
	| ts.TypeFlags.NumberLike
	| ts.TypeFlags.BooleanLike
	| ts.TypeFlags.ESSymbolLike
	| ts.TypeFlags.BigIntLike
	| ts.TypeFlags.Null
	| ts.TypeFlags.Undefined
	| ts.TypeFlags.Void
	| ts.TypeFlags.Never
	| ts.TypeFlags.Unknown
	| ts.TypeFlags.Any;
const OWNED = /\/effect\/(?:src|dist(?:\/dts)?)\/(?:Ref|SynchronizedRef|ScopedRef|Cache|ScopedCache|Semaphore|Deferred)\.(?:d\.)?ts$/u;
const COLLECTIONS = new Set(["Map", "ReadonlyMap", "Set", "ReadonlySet", "Array", "ReadonlyArray"]);

function owned(type: ts.Type): boolean {
	const symbol = type.getSymbol();
	return (symbol?.declarations ?? []).some((declaration) => {
		const path = declaration.getSourceFile().fileName.replaceAll("\\", "/");
		return OWNED.test(path) || (COLLECTIONS.has(symbol?.name ?? "") && /\/lib\.[^/]+\.d\.ts$/u.test(path));
	});
}

function reference(type: ts.Type): type is ts.TypeReference {
	return "objectFlags" in type && typeof type.objectFlags === "number" && (type.objectFlags & ts.ObjectFlags.Reference) !== 0;
}

export function initializerDependency(checker: ts.TypeChecker, type: ts.Type, seen = new Set<ts.Type>()): boolean {
	if (seen.has(type) || type.flags & DATA) {
		return false;
	}
	seen.add(type);
	if (type.isUnionOrIntersection()) {
		return type.types.some((part) => initializerDependency(checker, part, seen));
	}
	const success = effectSuccess(checker, type);
	if (success !== undefined) {
		return initializerDependency(checker, success, seen);
	}
	if (owned(type)) {
		const arguments_ = reference(type) ? checker.getTypeArguments(type) : [];
		return arguments_.some((argument) => initializerDependency(checker, argument, seen));
	}
	for (const signature of type.getCallSignatures()) {
		const result = signature.getReturnType();
		if (effectSuccess(checker, result) !== undefined || (result.getProperty("then") !== undefined && result.getSymbol()?.name === "Promise")) {
			return true;
		}
		if (initializerDependency(checker, result, seen)) {
			return true;
		}
	}
	return type.getProperties().some((property) => initializerDependency(checker, checker.getTypeOfSymbol(property), seen));
}
