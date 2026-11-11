import ts from "typescript";
import { presenceCheck } from "#adapters/presenceCheck.ts";
import { declarationOf, resolvedValue } from "#adapters/serviceModelSyntax.ts";

const RPC_MIDDLEWARE = "~effect/rpc/RpcMiddleware";

function implementationParameter(checker: ts.TypeChecker, parameter: ts.ParameterDeclaration): ts.ParameterDeclaration {
	const fn = parameter.parent;
	if (!(ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) || fn.body !== undefined || fn.name === undefined) {
		return parameter;
	}
	const implementation = checker
		.getSymbolAtLocation(fn.name)
		?.declarations?.find(
			(declaration) => (ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration)) && declaration.body !== undefined,
		);
	return implementation !== undefined && (ts.isFunctionDeclaration(implementation) || ts.isMethodDeclaration(implementation))
		? (implementation.parameters[fn.parameters.indexOf(parameter)] ?? parameter)
		: parameter;
}

function functionBody(parameter: ts.ParameterDeclaration): ts.Node | undefined {
	const fn = parameter.parent;
	return ts.isFunctionDeclaration(fn) || ts.isFunctionExpression(fn) || ts.isArrowFunction(fn) || ts.isMethodDeclaration(fn) ? fn.body : undefined;
}

function contextPick(checker: ts.TypeChecker, callee: ts.Expression): boolean {
	const declaration = declarationOf(checker, ts.isPropertyAccessExpression(callee) ? callee.name : callee);
	return (
		declaration !== undefined
		&& ts.isVariableDeclaration(declaration)
		&& declaration.name.getText() === "pick"
		&& /\/effect\/(?:src|dist(?:\/dts)?)\/Context\.(?:d\.)?ts$/u.test(declaration.getSourceFile().fileName.replaceAll("\\", "/"))
	);
}

function middlewareMember(expression: ts.Expression): boolean {
	return ts.isPropertyAccessExpression(expression) && expression.name.text === "middleware";
}

function middlewareCall(checker: ts.TypeChecker, callee: ts.Expression): boolean {
	if (middlewareMember(callee)) {
		return true;
	}
	const value = resolvedValue(checker, callee);
	return (
		ts.isCallExpression(value)
		&& ts.isPropertyAccessExpression(value.expression)
		&& value.expression.name.text === "bind"
		&& middlewareMember(value.expression.expression)
	);
}

function referredSymbol(checker: ts.TypeChecker, node: ts.Identifier): ts.Symbol | undefined {
	return ts.isShorthandPropertyAssignment(node.parent) ? checker.getShorthandAssignmentValueSymbol(node.parent) : checker.getSymbolAtLocation(node);
}

function everyReference(checker: ts.TypeChecker, body: ts.Node, name: ts.Identifier, permitted: (reference: ts.Identifier) => boolean): boolean {
	const symbol = checker.getSymbolAtLocation(name);
	function visit(node: ts.Node): boolean {
		if (ts.isIdentifier(node) && node !== name && referredSymbol(checker, node) === symbol && !permitted(node)) {
			return false;
		}
		return ts.forEachChild(node, (child) => !visit(child)) !== true;
	}
	return visit(body);
}

function calledMethod(checker: ts.TypeChecker, member: ts.Expression): boolean {
	if (!(ts.isCallExpression(member.parent) && member.parent.expression === member)) {
		return false;
	}
	return (
		!ts.isPropertyAccessExpression(member)
		|| ((checker.getSymbolAtLocation(member.name)?.flags ?? ts.SymbolFlags.Method) & ts.SymbolFlags.Method) !== 0
	);
}

export function declarationTagParameter(checker: ts.TypeChecker, carries: (type: ts.Type) => boolean) {
	const known = new Map<ts.ParameterDeclaration, boolean>();
	function middlewareTag(node: ts.Node): boolean {
		return checker.getApparentType(checker.getTypeAtLocation(node)).getProperty(RPC_MIDDLEWARE) !== undefined;
	}
	function middlewareSignature(parameter: ts.ParameterDeclaration): boolean {
		const member = ts.isFunctionTypeNode(parameter.parent) ? parameter.parent.parent : parameter.parent;
		return (ts.isPropertySignature(member) || ts.isMethodSignature(member)) && member.name.getText() === "middleware" && middlewareTag(parameter);
	}
	function forwardsDeclaration(call: ts.CallExpression, argument: ts.Expression): boolean {
		const target = checker.getResolvedSignature(call)?.declaration?.parameters[call.arguments.indexOf(argument)];
		return target !== undefined && ts.isParameter(target) && !ts.isSpreadElement(argument) && declarationOnly(target);
	}
	function declares(value: ts.Expression): boolean {
		const argument = ts.isSpreadElement(value.parent) ? value.parent : value;
		const call = argument.parent;
		if (!(ts.isCallExpression(call) && call.arguments.includes(argument))) {
			return false;
		}
		return (
			contextPick(checker, call.expression)
			|| (middlewareCall(checker, call.expression) && middlewareTag(value))
			|| forwardsDeclaration(call, argument)
		);
	}
	function carrier(value: ts.Expression): ts.Expression {
		const parent = value.parent;
		if (ts.isNonNullExpression(parent) || ts.isParenthesizedExpression(parent)) {
			return carrier(parent);
		}
		if ((ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) && parent.expression === value) {
			return carries(checker.getTypeAtLocation(parent)) ? carrier(parent) : parent;
		}
		return value;
	}
	function onlyDeclared(body: ts.Node, name: ts.BindingName, seen: { declared: boolean }): boolean {
		if (!ts.isIdentifier(name)) {
			return name.elements.every(
				(element) => ts.isOmittedExpression(element) || !carries(checker.getTypeAtLocation(element.name)) || onlyDeclared(body, element.name, seen),
			);
		}
		return everyReference(checker, body, name, (reference) => {
			const value = carrier(reference);
			if (!carries(checker.getTypeAtLocation(value))) {
				return !calledMethod(checker, value);
			}
			if (ts.isVariableDeclaration(value.parent) && value.parent.initializer === value) {
				return onlyDeclared(body, value.parent.name, seen);
			}
			if (presenceCheck(checker, value)) {
				return true;
			}
			const declaration = declares(value);
			seen.declared ||= declaration;
			return declaration;
		});
	}
	function declarationOnly(declared: ts.ParameterDeclaration): boolean {
		const parameter = implementationParameter(checker, declared);
		const cached = known.get(parameter);
		if (cached !== undefined) {
			return cached;
		}
		known.set(parameter, false);
		const body = functionBody(parameter);
		const seen = { declared: false };
		const result = middlewareSignature(parameter) || (body !== undefined && onlyDeclared(body, parameter.name, seen) && seen.declared);
		known.set(parameter, result);
		return result;
	}
	return declarationOnly;
}
