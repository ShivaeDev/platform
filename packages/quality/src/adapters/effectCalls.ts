import ts from "typescript";
import { declaredModule } from "#imports/declaredModule.ts";

const PIPELINES = new Set(["Channel", "Effect", "Layer", "Sink", "Stream"]);

function calleeName(node: ts.CallExpression | ts.NewExpression): ts.Node {
	return ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression;
}

function effectModule(fileName: string): boolean {
	const module = declaredModule(fileName);
	return module === "effect" || module?.startsWith("@effect/") === true;
}

function argumentOf(node: ts.Node): ts.CallExpression | undefined {
	const parent = node.parent;
	return ts.isCallExpression(parent) && parent.arguments.some((argument) => argument === node) ? parent : undefined;
}

function generator(node: ts.SignatureDeclaration): boolean {
	return (ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.asteriskToken !== undefined;
}

export function effectCallee(
	checker: ts.TypeChecker,
	node: ts.CallExpression | ts.NewExpression,
): { readonly file: string; readonly name: string } | undefined {
	const symbol = checker.getSymbolAtLocation(calleeName(node));
	const target = symbol !== undefined && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
	const file = target?.declarations?.[0]?.getSourceFile().fileName.replaceAll("\\", "/");
	return target === undefined || file === undefined || !effectModule(file) ? undefined : { file, name: target.name };
}

function pipelineValue(checker: ts.TypeChecker, node: ts.Node): boolean {
	const symbol = checker.getTypeAtLocation(node).getSymbol();
	const file = symbol?.declarations?.[0]?.getSourceFile().fileName;
	return symbol !== undefined && file !== undefined && PIPELINES.has(symbol.name) && effectModule(file);
}

function inPipeline(checker: ts.TypeChecker, node: ts.Node): boolean {
	const parent = node.parent;
	if (parent === undefined || ts.isFunctionLike(parent) || ts.isSourceFile(parent)) {
		return false;
	}
	return (ts.isCallExpression(parent) && pipelineValue(checker, parent)) || inPipeline(checker, parent);
}

function insideEffect(checker: ts.TypeChecker, node: ts.Node): boolean {
	const scope = ts.findAncestor(node.parent, ts.isFunctionLike);
	if (scope === undefined || generator(scope)) {
		return true;
	}
	const call = argumentOf(scope);
	return call !== undefined && (effectCallee(checker, call) !== undefined || insideEffect(checker, call));
}

export function unsafeOutsideEffect(checker: ts.TypeChecker, node: ts.CallExpression | ts.NewExpression): boolean {
	return effectCallee(checker, node)?.name.endsWith("Unsafe") === true && !inPipeline(checker, node) && !insideEffect(checker, node);
}
