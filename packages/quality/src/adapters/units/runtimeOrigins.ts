import ts from "typescript";
import { exportedRuntime, importedRuntime, type RuntimeName, runtimeImport } from "#adapters/units/runtimeImports.ts";
import { memberName } from "#rules/stories/syntax.ts";

function member(receiver: RuntimeName | undefined, name: string): RuntimeName | undefined {
	return receiver === undefined ? undefined : { ...receiver, path: [...receiver.path, name] };
}

function loadedModule(node: ts.CallExpression): RuntimeName | undefined {
	if (!(node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
		return undefined;
	}
	const [argument] = node.arguments;
	return argument !== undefined && ts.isStringLiteralLike(argument) ? runtimeImport(argument.text, []) : undefined;
}

export function runtimeOrigins(checker: ts.TypeChecker): (node: ts.Node) => RuntimeName | undefined {
	const known = new Map<ts.Node, RuntimeName | undefined>();
	const visiting = new Set<ts.Node>();

	function symbol(value: ts.Symbol | undefined): RuntimeName | undefined {
		const direct = value?.declarations?.map(visit).find((name) => name !== undefined);
		return direct ?? (value !== undefined && value.flags & ts.SymbolFlags.Alias ? symbol(checker.getAliasedSymbol(value)) : undefined);
	}

	function binding(node: ts.BindingElement): RuntimeName | undefined {
		if (!ts.isObjectBindingPattern(node.parent)) {
			return undefined;
		}
		const name = node.propertyName ?? node.name;
		return ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? member(visit(node.parent.parent), name.text) : undefined;
	}

	function declaration(node: ts.Node): RuntimeName | undefined {
		if (ts.isExportSpecifier(node)) {
			return exportedRuntime(node);
		}
		if (ts.isNamespaceExport(node)) {
			return exportedRuntime(node);
		}
		if (ts.isVariableDeclaration(node)) {
			return node.initializer === undefined ? undefined : visit(node.initializer);
		}
		return ts.isBindingElement(node) ? binding(node) : importedRuntime(node);
	}

	function nameOf(node: ts.PropertyAccessExpression | ts.ElementAccessExpression): string {
		const name = memberName(node);
		if (name !== undefined || ts.isPropertyAccessExpression(node)) {
			return name ?? "";
		}
		const key = checker.getTypeAtLocation(node.argumentExpression);
		return key.isStringLiteral() ? key.value : "";
	}

	function property(node: ts.PropertyAccessExpression | ts.ElementAccessExpression): RuntimeName | undefined {
		const direct = member(visit(node.expression), nameOf(node));
		if (direct !== undefined) {
			return direct;
		}
		const receiver = ts.isIdentifier(node.expression) ? checker.getSymbolAtLocation(node.expression) : undefined;
		const namespace = receiver?.declarations?.some(ts.isNamespaceImport) === true;
		return namespace ? symbol(checker.getSymbolAtLocation(ts.isPropertyAccessExpression(node) ? node.name : node.argumentExpression)) : undefined;
	}

	function origin(node: ts.Node): RuntimeName | undefined {
		if (ts.isIdentifier(node)) {
			return symbol(checker.getSymbolAtLocation(node));
		}
		if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
			return property(node);
		}
		if (
			ts.isParenthesizedExpression(node)
			|| ts.isAsExpression(node)
			|| ts.isSatisfiesExpression(node)
			|| ts.isNonNullExpression(node)
			|| ts.isAwaitExpression(node)
		) {
			return visit(node.expression);
		}
		return ts.isCallExpression(node) ? loadedModule(node) : declaration(node);
	}

	function visit(node: ts.Node): RuntimeName | undefined {
		if (known.has(node) || visiting.has(node)) {
			return known.get(node);
		}
		visiting.add(node);
		const name = origin(node);
		visiting.delete(node);
		known.set(node, name);
		return name;
	}
	return visit;
}
