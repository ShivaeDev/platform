import ts from "typescript";
import { unwrapped } from "#rules/stories/syntax.ts";

export type ChangeKeyApi = "name" | "keys" | "mutation";

function declaredApi(declaration: ts.Declaration, name: string): ChangeKeyApi | undefined {
	const path = declaration.getSourceFile().fileName.replaceAll("\\", "/");
	if (/\/(?:@shivaedev\/)?sql\/(?:src|dist)\/transact\.(?:d\.)?ts$/u.test(path) && name === "invalidateOnCommit") {
		return "keys";
	}
	if (/\/(?:@shivaedev\/)?changes\/(?:src|dist)\/keys\.(?:d\.)?ts$/u.test(path)) {
		if (["recordKey", "collectionInvalidationKeys"].includes(name)) {
			return "name";
		}
		return ["invalidationKeys", "readKeys"].includes(name) ? "keys" : undefined;
	}
	if (/\/effect\/(?:src|dist(?:\/dts)?)\/reactivity\/Reactivity\.(?:d\.)?ts$/u.test(path)) {
		if (["invalidate", "invalidateUnsafe"].includes(name)) {
			return "keys";
		}
		if (name === "mutation") {
			return ts.isPropertySignature(declaration) ? "keys" : "mutation";
		}
	}
	return undefined;
}

function reference(value: ts.Expression): ts.Node {
	if (ts.isPropertyAccessExpression(value)) {
		return value.name;
	}
	return ts.isElementAccessExpression(value) ? value.argumentExpression : value;
}

export function changeKeyApi(checker: ts.TypeChecker, expression: ts.Expression, seen = new Set<ts.Symbol>()): ChangeKeyApi | undefined {
	const value = unwrapped(expression);
	const member = reference(value);
	let symbol = checker.getSymbolAtLocation(member);
	if (symbol === undefined) {
		return undefined;
	}
	if ((symbol.flags & ts.SymbolFlags.Alias) !== 0) {
		symbol = checker.getAliasedSymbol(symbol);
	}
	if (seen.has(symbol)) {
		return undefined;
	}
	seen.add(symbol);
	for (const declaration of symbol.declarations ?? []) {
		const api = declaredApi(declaration, symbol.name);
		if (api !== undefined) {
			return api;
		}
		if (ts.isVariableDeclaration(declaration) && declaration.initializer !== undefined) {
			const aliased = changeKeyApi(checker, declaration.initializer, seen);
			if (aliased !== undefined) {
				return aliased;
			}
		}
	}
	return undefined;
}
