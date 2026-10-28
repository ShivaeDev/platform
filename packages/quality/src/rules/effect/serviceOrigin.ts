import ts from "typescript";
import { returnValues } from "#rules/stories/returnValues.ts";

const SERVICE_NAMES = new Set(["Service", "ServiceClass", "Key", "Reference", "Tag", "TagClass", "GenericTag"]);

function annotation(declaration: ts.Declaration): ts.TypeNode | undefined {
	if (
		ts.isVariableDeclaration(declaration)
		|| ts.isParameter(declaration)
		|| ts.isTypeAliasDeclaration(declaration)
		|| ts.isFunctionLike(declaration)
	) {
		return declaration.type;
	}
	return ts.isTypeParameterDeclaration(declaration) ? declaration.constraint : undefined;
}

function declarationOrigin(checker: ts.TypeChecker, declaration: ts.Declaration, seen: Set<ts.Symbol>): boolean {
	const type = annotation(declaration);
	if (type !== undefined && serviceOrigin(checker, type, seen)) {
		return true;
	}
	if (ts.isVariableDeclaration(declaration) && declaration.initializer !== undefined) {
		return serviceOrigin(checker, declaration.initializer, seen);
	}
	if (ts.isClassDeclaration(declaration) || ts.isInterfaceDeclaration(declaration)) {
		return declaration.heritageClauses?.some((clause) => clause.types.some((base) => serviceOrigin(checker, base.expression, seen))) ?? false;
	}
	return ts.isFunctionLike(declaration) && returnValues(declaration).some((value) => value !== undefined && serviceOrigin(checker, value, seen));
}

function symbolOrigin(checker: ts.TypeChecker, symbol: ts.Symbol, seen: Set<ts.Symbol>): boolean {
	const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
	if (seen.has(target)) {
		return false;
	}
	seen.add(target);
	return (target.declarations ?? []).some((declaration) => {
		const file = declaration.getSourceFile().fileName.replaceAll("\\", "/");
		if (
			/\/effect\/(?:src|dist)\/(?:Context|Effect)(?:\.d)?\.ts$/u.test(file)
			&& SERVICE_NAMES.has(target.name)
			&& (ts.isVariableDeclaration(declaration)
				|| ts.isFunctionDeclaration(declaration)
				|| ts.isClassDeclaration(declaration)
				|| ts.isInterfaceDeclaration(declaration)
				|| ts.isTypeAliasDeclaration(declaration))
		) {
			return true;
		}
		if (file.endsWith("/service/src/defineService.ts") && target.name === "defineService") {
			return true;
		}
		return declarationOrigin(checker, declaration, seen);
	});
}

function reference(node: ts.Node): ts.Node | undefined {
	if (ts.isCallExpression(node)) {
		return node.expression;
	}
	if (ts.isTypeReferenceNode(node)) {
		return node.typeName;
	}
	if (ts.isTypeQueryNode(node)) {
		return node.exprName;
	}
	return ts.isParenthesizedTypeNode(node) ? node.type : undefined;
}

export function serviceOrigin(checker: ts.TypeChecker, node: ts.Node | ts.Symbol, seen = new Set<ts.Symbol>()): boolean {
	if (!("kind" in node)) {
		return symbolOrigin(checker, node, seen);
	}
	const referred = reference(node);
	if (referred !== undefined) {
		return serviceOrigin(checker, referred, seen);
	}
	if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
		return node.types.some((part) => serviceOrigin(checker, part, seen));
	}
	if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
		return returnValues(node).some((value) => value !== undefined && serviceOrigin(checker, value, seen));
	}
	if (ts.isPropertyAccessExpression(node) && !SERVICE_NAMES.has(node.name.text)) {
		return false;
	}
	const location = ts.isQualifiedName(node) ? node.right : node;
	if (!(ts.isIdentifier(location) || ts.isPropertyAccessExpression(location))) {
		return false;
	}
	const symbol = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(location) ? location.name : location);
	return symbol !== undefined && symbolOrigin(checker, symbol, seen);
}
