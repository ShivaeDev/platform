import ts from "typescript";
import { importOrigins, originOf } from "./importOrigins.ts";

function returned(body: ts.ConciseBody): ts.Expression | undefined {
	if (!ts.isBlock(body)) {
		return body;
	}
	const statement = body.statements.length === 1 ? body.statements[0] : undefined;
	return statement !== undefined && ts.isReturnStatement(statement) ? statement.expression : undefined;
}

function forwarding(node: ts.FunctionLikeDeclaration, origins: ReadonlyMap<string, string>): string | undefined {
	if (
		node.body === undefined
		|| node.asteriskToken !== undefined
		|| node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)
	) {
		return undefined;
	}
	const call = returned(node.body);
	if (call === undefined || !ts.isCallExpression(call) || call.questionDotToken !== undefined || call.arguments.length !== node.parameters.length) {
		return undefined;
	}
	const visible = new Map(origins);
	for (const [index, parameter] of node.parameters.entries()) {
		const argument = call.arguments[index];
		if (!ts.isIdentifier(parameter.name) || parameter.initializer !== undefined || argument === undefined) {
			return undefined;
		}
		const value = ts.isSpreadElement(argument) ? argument.expression : argument;
		if (!ts.isIdentifier(value) || value.text !== parameter.name.text || Boolean(parameter.dotDotDotToken) !== ts.isSpreadElement(argument)) {
			return undefined;
		}
		visible.delete(parameter.name.text);
	}
	return originOf(call.expression, visible);
}

function valueOrigins(node: ts.Expression, origins: ReadonlyMap<string, string>): readonly string[] {
	if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
		return valueOrigins(node.expression, origins);
	}
	const origin = originOf(node, origins);
	if (origin !== undefined) {
		return [origin];
	}
	if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
		const module = forwarding(node, origins);
		return module === undefined ? [] : [module];
	}
	if (ts.isObjectLiteralExpression(node)) {
		const modules = node.properties.map((property) => {
			if (ts.isShorthandPropertyAssignment(property)) {
				return valueOrigins(property.name, origins);
			}
			if (ts.isPropertyAssignment(property)) {
				return valueOrigins(property.initializer, origins);
			}
			if (ts.isSpreadAssignment(property)) {
				return valueOrigins(property.expression, origins);
			}
			return [];
		});
		return modules.length > 0 && modules.every((module) => module.length > 0) ? modules.flat() : [];
	}
	return [];
}

export interface SecondName {
	readonly modules: readonly string[];
	readonly node: ts.Node;
}

function exportedNames(source: ts.SourceFile): ReadonlySet<string> {
	return new Set(
		source.statements.flatMap((statement) =>
			ts.isExportDeclaration(statement)
			&& statement.moduleSpecifier === undefined
			&& statement.exportClause !== undefined
			&& ts.isNamedExports(statement.exportClause)
				? statement.exportClause.elements.map((element) => (element.propertyName ?? element.name).text)
				: [],
		),
	);
}

function declarations(statement: ts.Statement, exported: ReadonlySet<string>): readonly (ts.VariableDeclaration | ts.FunctionDeclaration)[] {
	const publicStatement =
		ts.canHaveModifiers(statement) && ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
	let nodes: readonly (ts.VariableDeclaration | ts.FunctionDeclaration)[] = [];
	if (ts.isVariableStatement(statement)) {
		nodes = statement.declarationList.declarations;
	} else if (ts.isFunctionDeclaration(statement)) {
		nodes = [statement];
	}
	return nodes.filter((node) => node.name !== undefined && ts.isIdentifier(node.name) && (publicStatement || exported.has(node.name.text)));
}

function declarationOrigins(
	node: ts.VariableDeclaration | ts.FunctionDeclaration,
	origins: ReadonlyMap<string, string>,
	source: ts.SourceFile,
): readonly string[] {
	if (ts.isVariableDeclaration(node)) {
		return node.initializer === undefined ? [] : valueOrigins(node.initializer, origins);
	}
	const overloaded = source.statements.some((other) => ts.isFunctionDeclaration(other) && other !== node && other.name?.text === node.name?.text);
	const module = overloaded ? undefined : forwarding(node, origins);
	return module === undefined ? [] : [module];
}

export function secondNames(source: ts.SourceFile): readonly SecondName[] {
	const origins = importOrigins(source);
	const exported = exportedNames(source);
	return source.statements.flatMap((statement) =>
		declarations(statement, exported).flatMap((node) => {
			const modules = declarationOrigins(node, origins, source);
			return modules.length === 0 ? [] : [{ modules: [...new Set(modules)], node }];
		}),
	);
}
