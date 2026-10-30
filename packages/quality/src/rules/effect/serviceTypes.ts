import ts from "typescript";

const SERVICE = "~effect/Context/Service";
const CONTEXT = "~effect/Context";

export function serviceTypes(checker: ts.TypeChecker) {
	const shapes = new Set<ts.Type>();
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
	function remember(type: ts.Type): void {
		if (type.getProperty(SERVICE) === undefined) {
			return;
		}
		const shape = propertyType(type, "Service");
		if (
			shape !== undefined
			&& shape.flags & ts.TypeFlags.Object
			&& (shape.getProperties().length > 0 || shape.getCallSignatures().length > 0)
			&& checker.getIndexInfosOfType(shape).length === 0
			&& !options(shape)
			&& (shape.getCallSignatures().length === 0 || type.getProperty("~effect/Context/Reference") === undefined)
		) {
			shapes.add(shape);
		}
	}
	function computation(type: ts.Type): boolean {
		return ["~effect/Effect", "~effect/Stream"].some((brand) => type.getProperty(brand) !== undefined);
	}
	function implementation(type: ts.Type): boolean {
		if (shapes.has(type)) {
			return true;
		}
		const declaration = type.getSymbol()?.valueDeclaration;
		const contextual = declaration !== undefined && ts.isObjectLiteralExpression(declaration) ? checker.getContextualType(declaration) : undefined;
		return contextual !== undefined && shapes.has(contextual);
	}
	function nonEmptyContext(context: ts.Type): boolean {
		const variance = propertyType(context, "_Services");
		const parameter = variance?.getCallSignatures()[0]?.parameters[0];
		if (parameter === undefined) {
			return false;
		}
		const required = checker.getTypeOfSymbol(parameter);
		return !((checker.getBaseConstraintOfType(required) ?? required).flags & ts.TypeFlags.Never);
	}
	function carries(type: ts.Type, seen = new Set<ts.Type>()): boolean {
		if (
			seen.has(type)
			|| type.flags
				& (ts.TypeFlags.Any
					| ts.TypeFlags.Unknown
					| ts.TypeFlags.Never
					| ts.TypeFlags.StringLike
					| ts.TypeFlags.NumberLike
					| ts.TypeFlags.BooleanLike
					| ts.TypeFlags.ESSymbolLike
					| ts.TypeFlags.BigIntLike)
		) {
			return false;
		}
		seen.add(type);
		if (type.isUnionOrIntersection()) {
			return type.types.some((part) => carries(part, seen));
		}
		if (type.getProperty(SERVICE) !== undefined) {
			return true;
		}
		const context = propertyType(type, CONTEXT);
		if (context !== undefined) {
			return nonEmptyContext(context);
		}
		if (computation(type)) {
			return false;
		}
		const constraint = checker.getBaseConstraintOfType(type);
		if (constraint !== undefined && carries(constraint, seen)) {
			return true;
		}
		return (
			implementation(type)
			|| checker.getIndexInfosOfType(type).some((index) => carries(index.type, seen))
			|| type.getProperties().some((property) => !(property.flags & ts.SymbolFlags.Method) && carries(checker.getTypeOfSymbol(property), seen))
		);
	}
	return {
		carries: (type: ts.Type) => {
			const known = carried.get(type);
			if (known !== undefined) {
				return known;
			}
			const result = carries(type);
			carried.set(type, result);
			return result;
		},
		computation,
		implementation,
		remember,
	};
}
