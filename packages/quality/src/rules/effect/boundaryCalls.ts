import ts from "typescript";
import { boundaryReference } from "#rules/effect/boundaryReference.ts";

function synchronousIo(reference: string): boolean {
	return /^(?:node:)?fs\.[^.]+Sync$/u.test(reference) || /^(?:node:)?child_process\.(?:execSync|execFileSync|spawnSync)$/u.test(reference);
}

function knownThrowing(reference: string): boolean {
	return (
		(synchronousIo(reference) && !/^(?:node:)?fs\.existsSync$/u.test(reference))
		|| /^(?:JSON\.parse|decodeURI|decodeURIComponent|encodeURI|encodeURIComponent|BigInt)$/u.test(reference)
		|| /^(?:effect\.Schema|effect\/Schema)\.(?:decodeUnknownSync|decodeSync|encodeUnknownSync|encodeSync)$/u.test(reference)
	);
}

function immediateBody(node: ts.Node): ts.ConciseBody | undefined {
	if (!(ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node))) {
		return undefined;
	}
	if (
		node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)
		|| ("asteriskToken" in node && node.asteriskToken !== undefined)
	) {
		return undefined;
	}
	return node.body;
}

function functionBody(checker: ts.TypeChecker, expression: ts.Expression): ts.ConciseBody | undefined {
	if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
		return immediateBody(expression);
	}
	const symbol = checker.getSymbolAtLocation(expression);
	const target = symbol !== undefined && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
	for (const declaration of target?.declarations ?? []) {
		if (declaration.getSourceFile().isDeclarationFile || /(?:^|\/)node_modules\//u.test(declaration.getSourceFile().fileName)) {
			continue;
		}
		if (ts.isVariableDeclaration(declaration) && declaration.initializer !== undefined) {
			return functionBody(checker, declaration.initializer);
		}
		const body = immediateBody(declaration);
		if (body !== undefined) {
			return body;
		}
	}
	return undefined;
}

function runnerReference(node: ts.Node): ts.Node | undefined {
	if (ts.isCallExpression(node)) {
		return ts.isIdentifier(node.expression) ? node.expression : undefined;
	}
	if (!ts.isIdentifier(node)) {
		return ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) ? node : undefined;
	}
	const parent = node.parent;
	if (ts.isCallExpression(parent) && parent.expression === node) {
		return undefined;
	}
	return "name" in parent && parent.name === node && !ts.isShorthandPropertyAssignment(parent) ? undefined : node;
}

export function boundaryCalls(checker: ts.TypeChecker) {
	const throwing = new Map<ts.Node, boolean>();
	function throws(body: ts.Node): boolean {
		const previous = throwing.get(body);
		if (previous !== undefined) {
			return previous;
		}
		function visit(node: ts.Node): boolean {
			return ts.isThrowStatement(node) || (!ts.isFunctionLike(node) && (ts.forEachChild(node, visit) ?? false));
		}
		const result = visit(body);
		throwing.set(body, result);
		return result;
	}
	function guard(call: ts.CallExpression): boolean {
		const body = functionBody(checker, call.expression);
		return body !== undefined && !/(?:^|\/)adapters\//u.test(body.getSourceFile().fileName) && throws(body);
	}
	function unsafeSync(call: ts.CallExpression): boolean {
		const callback = call.arguments[0];
		const body = callback === undefined ? undefined : functionBody(checker, callback);
		if (body === undefined) {
			return callback !== undefined && knownThrowing(boundaryReference(checker, callback) ?? "");
		}
		function visit(node: ts.Node): boolean {
			if (ts.isFunctionLike(node)) {
				return false;
			}
			if (ts.isThrowStatement(node)) {
				return true;
			}
			if (ts.isCallExpression(node) && (knownThrowing(boundaryReference(checker, node.expression) ?? "") || guard(node))) {
				return true;
			}
			return ts.forEachChild(node, visit) ?? false;
		}
		return visit(body);
	}
	function runner(node: ts.Node, entryPoint: boolean): string | undefined {
		if (entryPoint) {
			return undefined;
		}
		const expression = runnerReference(node);
		if (expression === undefined) {
			return undefined;
		}
		const reference = boundaryReference(checker, expression);
		return /^effect(?:\.Effect|\/Effect)\.run/u.test(reference ?? "") ? `${reference} outside an entry point` : undefined;
	}
	return (node: ts.Node, entryPoint: boolean): string | undefined => {
		const runtime = runner(node, entryPoint);
		if (runtime !== undefined) {
			return runtime;
		}
		if (!ts.isCallExpression(node)) {
			return undefined;
		}
		const reference = boundaryReference(checker, node.expression) ?? "";
		if (synchronousIo(reference)) {
			return `synchronous IO (${reference})`;
		}
		if (/^effect(?:\.Effect|\/Effect)\.sync$/u.test(reference) && unsafeSync(node)) {
			return "Effect.sync with a throwing body";
		}
		return guard(node) ? `throwing helper call (${node.expression.getText()})` : undefined;
	};
}
