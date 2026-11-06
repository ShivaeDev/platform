import ts from "typescript";
import type { serviceTypes } from "#rules/effect/serviceTypes.ts";

const NATIVE =
	/\/effect\/(?:src|dist(?:\/dts)?)\/(?:Ref|SynchronizedRef|ScopedRef|Cache|ScopedCache|Deferred|Queue|PubSub|HashMap|HashSet)\.(?:d\.)?ts$/u;
const COLLECTIONS = new Set(["Map", "ReadonlyMap", "Set", "ReadonlySet", "Array", "ReadonlyArray"]);

function reference(type: ts.Type): type is ts.TypeReference {
	return "objectFlags" in type && typeof type.objectFlags === "number" && (type.objectFlags & ts.ObjectFlags.Reference) !== 0;
}

function container(type: ts.Type): boolean {
	const symbol = type.getSymbol();
	return (symbol?.declarations ?? []).some((declaration) => {
		const file = declaration.getSourceFile().fileName.replaceAll("\\", "/");
		return NATIVE.test(file) || (COLLECTIONS.has(symbol?.name ?? "") && /\/lib\.[^/]+\.d\.ts$/u.test(file));
	});
}

export function containerDependency(
	checker: ts.TypeChecker,
	type: ts.Type,
	services: ReturnType<typeof serviceTypes>,
	seen = new Set<ts.Type>(),
): boolean {
	if (seen.has(type) || !(type.flags & (ts.TypeFlags.Object | ts.TypeFlags.Union | ts.TypeFlags.Intersection)) || services.computation(type)) {
		return false;
	}
	seen.add(type);
	if (type.isUnionOrIntersection()) {
		return type.types.some((part) => containerDependency(checker, part, services, seen));
	}
	if (container(type) && reference(type)) {
		return checker.getTypeArguments(type).some((argument) => services.carries(argument) || containerDependency(checker, argument, services, seen));
	}
	return (
		type.getCallSignatures().length === 0
		&& type.getProperties().some((property) => containerDependency(checker, checker.getTypeOfSymbol(property), services, seen))
	);
}
