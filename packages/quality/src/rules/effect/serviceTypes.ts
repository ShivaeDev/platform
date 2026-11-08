import ts from "typescript";
import { callerContextData } from "#adapters/callerContextData.ts";
import { clientHandle } from "#adapters/clientHandle.ts";
import { nonEmptyContext } from "#adapters/nonEmptyContext.ts";
import { valueType } from "#adapters/valueType.ts";

const SERVICE = "~effect/Context/Service";
const CONTEXT = "~effect/Context";

export function serviceTypes(checker: ts.TypeChecker, initializerState = false) {
	const shapes = new Set<ts.Type>();
	const contextData = new Set<ts.Type>();
	const carried = new Map<ts.Type, boolean>();
	function propertyType(type: ts.Type, name: string): ts.Type | undefined {
		const property = type.getProperty(name);
		return property === undefined ? undefined : checker.getTypeOfSymbol(property);
	}
	function options(type: ts.Type): boolean {
		if (type.getCallSignatures().length > 0) {
			return false;
		}
		return type
			.getProperties()
			.every(
				(property) =>
					(property.flags & ts.SymbolFlags.Optional) !== 0
					&& checker.getNonNullableType(checker.getTypeOfSymbol(property)).getCallSignatures().length === 0,
			);
	}
	function remember(type: ts.Type, name?: string): void {
		if (type.getProperty(SERVICE) === undefined) {
			return;
		}
		const shape = propertyType(type, "Service");
		if (initializerState && name !== undefined && shape !== undefined && callerContextData(checker, shape, name)) {
			contextData.add(type);
			contextData.add(shape);
			shapes.delete(shape);
			return;
		}
		if (shape !== undefined && contextData.has(shape)) {
			return;
		}
		if (
			shape !== undefined
			&& shape.flags & ts.TypeFlags.Object
			&& (shape.getProperties().length > 0 || shape.getCallSignatures().length > 0)
			&& checker.getIndexInfosOfType(shape).length === 0
			&& (initializerState || !options(shape))
			&& (shape.getCallSignatures().length === 0 || type.getProperty("~effect/Context/Reference") === undefined)
		) {
			shapes.add(shape);
		}
	}
	function computation(type: ts.Type): boolean {
		const handle = ["~effect/Effect", "~effect/Stream", "~effect/Fiber", "~effect/Scope/Closeable"].some(
			(brand) => type.getProperty(brand) !== undefined,
		);
		const symbol = type.getSymbol();
		return (
			handle
			|| (initializerState && type.getProperty("~effect/Scope") !== undefined)
			|| (symbol?.name === "AtomContext"
				&& (symbol.declarations ?? []).some((declaration) =>
					/\/effect\/(?:src|dist)\/reactivity\/Atom\.(?:d\.)?ts$/u.test(declaration.getSourceFile().fileName.replaceAll("\\", "/")),
				))
		);
	}
	function implementation(type: ts.Type): boolean {
		if (shapes.has(type)) {
			return true;
		}
		const declaration = type.getSymbol()?.valueDeclaration;
		const contextual = declaration !== undefined && ts.isObjectLiteralExpression(declaration) ? checker.getContextualType(declaration) : undefined;
		return contextual !== undefined && shapes.has(contextual);
	}
	function serviceReturn(type: ts.Type): boolean {
		if (type.isUnionOrIntersection()) {
			return type.types.some(serviceReturn);
		}
		const context = propertyType(type, CONTEXT);
		return (
			type.getProperty(SERVICE) !== undefined
			|| (!computation(type) && (implementation(type) || (context !== undefined && nonEmptyContext(checker, context))))
		);
	}
	function factoryService(type: ts.Type): boolean {
		return !initializerState && type.getCallSignatures().some((signature) => serviceReturn(signature.getReturnType()));
	}
	function exempt(type: ts.Type, handles: boolean): boolean {
		return contextData.has(type) || valueType(type) || (!handles && clientHandle(type));
	}
	function carries(type: ts.Type, handles: boolean, seen = new Set<ts.Type>()): boolean {
		if (seen.has(type) || exempt(type, handles)) {
			return false;
		}
		seen.add(type);
		if (type.isUnionOrIntersection()) {
			return type.types.some((part) => carries(part, handles, seen));
		}
		if (type.getProperty(SERVICE) !== undefined) {
			return true;
		}
		const context = propertyType(type, CONTEXT);
		if (context !== undefined) {
			return nonEmptyContext(checker, context);
		}
		if (computation(type)) {
			return false;
		}
		const constraint = checker.getBaseConstraintOfType(type);
		if (constraint !== undefined && carries(constraint, handles, seen)) {
			return true;
		}
		return (
			implementation(type)
			|| factoryService(type)
			|| checker.getIndexInfosOfType(type).some((index) => carries(index.type, handles, seen))
			|| type
				.getProperties()
				.some((property) => !(property.flags & ts.SymbolFlags.Method) && carries(checker.getTypeOfSymbol(property), handles, seen))
		);
	}
	return {
		carries: (type: ts.Type) => {
			const known = carried.get(type);
			if (known !== undefined) {
				return known;
			}
			const result = carries(type, true);
			carried.set(type, result);
			return result;
		},
		carriesBeyondClientHandles: (type: ts.Type) => carries(type, false),
		computation,
		implementation,
		remember,
	};
}
