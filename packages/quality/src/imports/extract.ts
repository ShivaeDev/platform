import ts from "typescript";

export interface ImportRequest {
	readonly line: number;
	readonly specifier: string;
	readonly type: boolean;
}

interface Found {
	readonly node: ts.Node | undefined;
	readonly type: boolean;
}

const MAY_CALL = /\b(?:import|require)\s*\(/u;

function lineOf(source: ts.SourceFile, node: ts.Node): number {
	return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function declared(statement: ts.Statement): Found | undefined {
	if (ts.isImportDeclaration(statement)) {
		return { node: statement.moduleSpecifier, type: statement.importClause?.isTypeOnly === true };
	}
	if (ts.isExportDeclaration(statement)) {
		return { node: statement.moduleSpecifier, type: statement.isTypeOnly };
	}
	if (ts.isImportEqualsDeclaration(statement) && ts.isExternalModuleReference(statement.moduleReference)) {
		return { node: statement.moduleReference.expression, type: statement.isTypeOnly };
	}
	return undefined;
}

function isRequire(call: ts.CallExpression): boolean {
	return ts.isIdentifier(call.expression) && call.expression.text === "require";
}

function nested(node: ts.Node): Found | undefined {
	if (ts.isCallExpression(node)) {
		const calls = node.expression.kind === ts.SyntaxKind.ImportKeyword || isRequire(node);
		return calls ? { node: node.arguments[0], type: false } : undefined;
	}
	if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
		return { node: node.argument.literal, type: true };
	}
	return undefined;
}

function requestOf(source: ts.SourceFile, at: ts.Node, found: Found | undefined): readonly ImportRequest[] {
	if (found?.node === undefined || !ts.isStringLiteralLike(found.node)) {
		return [];
	}
	return [{ line: lineOf(source, at), specifier: found.node.text, type: found.type }];
}

function nestedRequests(source: ts.SourceFile): readonly ImportRequest[] {
	if (!MAY_CALL.test(source.text)) {
		return [];
	}
	const requests: ImportRequest[] = [];
	function visit(node: ts.Node): void {
		requests.push(...requestOf(source, node, nested(node)));
		ts.forEachChild(node, visit);
	}
	visit(source);
	return requests;
}

export function importsOf(source: ts.SourceFile, declarationFile: boolean): readonly ImportRequest[] {
	const all = [...source.statements.flatMap((statement) => requestOf(source, statement, declared(statement))), ...nestedRequests(source)];
	return declarationFile ? all.map((request) => ({ ...request, type: true })) : all;
}
