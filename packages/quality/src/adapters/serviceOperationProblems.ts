import { posix } from "node:path";
import ts from "typescript";
import { serviceProperty } from "#adapters/serviceAssemblySyntax.ts";
import { effectApi, resolvedValue } from "#adapters/serviceModelSyntax.ts";
import { returnValues } from "#rules/stories/returnValues.ts";

function operationValues(checker: ts.TypeChecker, expression: ts.Expression, seen = new Set<ts.Node>()): readonly ts.Node[] {
	const value = resolvedValue(checker, expression);
	if (seen.has(value)) {
		return [value];
	}
	seen.add(value);
	if (ts.isConditionalExpression(value)) {
		return [value.whenTrue, value.whenFalse].flatMap((branch) => operationValues(checker, branch, new Set(seen)));
	}
	if (!ts.isCallExpression(value)) {
		return [value];
	}
	if (ts.isCallExpression(value.expression) && effectApi(checker, value.expression.expression, "fn")) {
		return [value];
	}
	if (ts.isPropertyAccessExpression(value.expression) && value.expression.name.text === "pipe") {
		return operationValues(checker, value.expression.expression, seen);
	}
	// genericMethod preserves the operation rather than introducing a new implementation.
	const declaration = checker.getResolvedSignature(value)?.declaration;
	if (
		declaration !== undefined
		&& /\/service\/(?:src|dist)\/genericMethod\.(?:d\.)?ts$/u.test(declaration.getSourceFile().fileName.replaceAll("\\", "/"))
	) {
		const method = value.arguments[0];
		return method === undefined ? [value] : operationValues(checker, method, seen);
	}
	const reference = resolvedValue(checker, value.expression);
	if (ts.isFunctionLike(reference)) {
		const returns = returnValues(reference).flatMap((item) => (item === undefined ? [] : operationValues(checker, item, new Set(seen))));
		return returns.length > 0 ? returns : [value];
	}
	return [value];
}

interface OperationProblem {
	readonly message: string;
	readonly node: ts.Node;
}

function tracedOperation(checker: ts.TypeChecker, value: ts.Node, span: string): boolean {
	if (!(ts.isCallExpression(value) && ts.isCallExpression(value.expression))) {
		return false;
	}
	const label = value.expression.arguments[0];
	return effectApi(checker, value.expression.expression, "fn") && label !== undefined && ts.isStringLiteral(label) && label.text === span;
}

function operationProblems(
	checker: ts.TypeChecker,
	object: ts.ObjectLiteralExpression,
	member: ts.ObjectLiteralElementLike,
	service: string | undefined,
	file: string,
): readonly OperationProblem[] {
	const name = member.name;
	if (name === undefined || !(ts.isIdentifier(name) || ts.isStringLiteral(name))) {
		return [];
	}
	const expression = serviceProperty(object, name.text);
	const span = `${service ?? "Service"}.${name.text}`;
	const values = expression === undefined ? [member] : operationValues(checker, expression);
	const found: OperationProblem[] = [];
	if (service === undefined || !values.every((value) => tracedOperation(checker, value, span))) {
		found.push({
			message: `Export this operation as Effect.fn("${span}"). Yield dependencies and the caller from the environment; a state factory may capture only owned lifetime state.`,
			node: member,
		});
	}
	if (
		expression !== undefined
		&& values.some((value) => {
			const path = value.getSourceFile().fileName.replaceAll("\\", "/");
			return posix.dirname(path) !== posix.dirname(file) || posix.basename(path) !== `${name.text}.ts`;
		})
	) {
		found.push({
			message: `Keep the ${name.text} operation export in ${name.text}.ts beside this service's service.ts, one operation per file.`,
			node: member,
		});
	}
	return found;
}

export function serviceOperationProblems(checker: ts.TypeChecker, config: ts.ObjectLiteralExpression, file: string): readonly OperationProblem[] {
	const id = serviceProperty(config, "id");
	const type = id === undefined ? undefined : checker.getTypeAtLocation(id);
	const service = type?.isStringLiteral() ? type.value.split("/").at(-1) : undefined;
	const methods = serviceProperty(config, "methods");
	if (methods === undefined) {
		return [];
	}
	const factory = resolvedValue(checker, methods);
	const records = ts.isFunctionLike(factory) ? returnValues(factory) : [methods];
	return records.flatMap((record) => {
		if (record === undefined) {
			return [];
		}
		const object = resolvedValue(checker, record);
		return ts.isObjectLiteralExpression(object)
			? object.properties.flatMap((member) => operationProblems(checker, object, member, service, file))
			: [];
	});
}
