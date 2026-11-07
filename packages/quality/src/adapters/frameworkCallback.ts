import ts from "typescript";
import { callbackEscapes } from "#adapters/callbackEscapes.ts";
import { contextualCallbackType } from "#adapters/foreignCallback.ts";
import { frameworkOwner } from "#adapters/frameworkOwner.ts";
import { effectApi, resolvedValue } from "#adapters/serviceModelSyntax.ts";

function supplied(signature: ts.Signature, local: ReadonlySet<ts.SourceFile>): boolean {
	return signature.declaration !== undefined && !local.has(signature.declaration.getSourceFile());
}

function wrapsEffectFunction(checker: ts.TypeChecker, expression: ts.Expression): boolean {
	let callee = expression;
	let value: ts.Node = ts.isIdentifier(callee) ? resolvedValue(checker, callee) : callee;
	while (ts.isCallExpression(value)) {
		if (value.arguments.some((argument) => checker.getTypeAtLocation(argument).getCallSignatures().length > 0)) {
			return false;
		}
		callee = value.expression;
		value = ts.isIdentifier(callee) ? resolvedValue(checker, callee) : callee;
	}
	return effectApi(checker, callee, "fn") || effectApi(checker, callee, "fnUntraced");
}

function suppliedCallback(checker: ts.TypeChecker, node: ts.Node, local: ReadonlySet<ts.SourceFile>): boolean {
	const contextual = contextualCallbackType(checker, node);
	return (contextual === undefined ? [] : checker.getNonNullableType(contextual).getCallSignatures()).some((signature) => supplied(signature, local));
}

export function frameworkCallback(checker: ts.TypeChecker, node: ts.Node, local: ReadonlySet<ts.SourceFile>, seen = new Set<ts.Node>()): boolean {
	if (seen.has(node)) {
		return false;
	}
	seen.add(node);
	if (ts.isMethodDeclaration(node) && suppliedCallback(checker, node, local)) {
		return true;
	}
	if (!(ts.isArrowFunction(node) || ts.isFunctionExpression(node))) {
		return false;
	}
	if (ts.isCallExpression(node.parent)) {
		if (wrapsEffectFunction(checker, node.parent.expression)) {
			return false;
		}
		if (frameworkOwner(checker, node.parent.expression, local, (owner) => frameworkCallback(checker, owner, local, seen))) {
			const parent = node.parent.parent;
			return !(
				(ts.isVariableDeclaration(parent)
					|| ts.isReturnStatement(parent)
					|| ts.isPropertyAssignment(parent)
					|| (ts.isCallExpression(parent) && parent.expression === node.parent))
				&& callbackEscapes(checker, node.parent, node)
			);
		}
		return !callbackEscapes(checker, node.parent, node);
	}
	if (suppliedCallback(checker, node, local)) {
		return true;
	}
	const property = node.parent;
	const object = property.parent;
	const call = object.parent;
	return (
		ts.isPropertyAssignment(property)
		&& ts.isObjectLiteralExpression(object)
		&& ts.isCallExpression(call)
		&& checker
			.getTypeAtLocation(call.expression)
			.getCallSignatures()
			.some((signature) => supplied(signature, local))
	);
}

function overloadedParameter(checker: ts.TypeChecker, parameter: ts.ParameterDeclaration): ts.ParameterDeclaration | undefined {
	const fn = parameter.parent;
	if ((ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) && fn.name !== undefined) {
		const symbol = checker.getSymbolAtLocation(fn.name);
		const signature = symbol?.declarations?.find(
			(declaration) => (ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration)) && declaration.body === undefined,
		);
		if (signature !== undefined && (ts.isFunctionDeclaration(signature) || ts.isMethodDeclaration(signature))) {
			return signature.parameters[fn.parameters.indexOf(parameter)];
		}
	}
	return undefined;
}

export function parameterSite(
	checker: ts.TypeChecker,
	parameter: ts.ParameterDeclaration,
	local: ReadonlySet<ts.SourceFile>,
): ts.ParameterDeclaration {
	const fn = parameter.parent;
	const overload = overloadedParameter(checker, parameter);
	if (overload !== undefined) {
		return overload;
	}
	if (!(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) {
		return parameter;
	}
	const contextual = checker.getContextualType(fn);
	const signature = contextual === undefined ? undefined : checker.getNonNullableType(contextual).getCallSignatures()[0];
	const declared = signature?.declaration;
	if (declared !== undefined && declared !== fn && local.has(declared.getSourceFile())) {
		const site = declared.parameters[fn.parameters.indexOf(parameter)];
		if (site !== undefined && ts.isParameter(site)) {
			return site;
		}
	}
	const variable = fn.parent;
	if (!(ts.isVariableDeclaration(variable) && variable.type !== undefined && ts.isFunctionTypeNode(variable.type))) {
		return parameter;
	}
	return variable.type.parameters[fn.parameters.indexOf(parameter)] ?? parameter;
}
