import ts from "typescript";

export type ImportKind = "import" | "path-reference" | "resolve" | "type-reference";

export interface ImportRequest {
	readonly kind: ImportKind;
	readonly line: number;
	readonly specifier: string;
	readonly type: boolean;
}

interface Found {
	readonly kind: ImportKind;
	readonly node: ts.Node | undefined;
	readonly type: boolean;
}

const MAY_CALL = /\b(?:import|require)\s*\(|\b(?:require|import\.meta)\.resolve\s*\(/u;

const JSDOC_IMPORT = "@import";

function lineAt(source: ts.SourceFile, position: number): number {
	return source.getLineAndCharacterOfPosition(position).line + 1;
}

function declared(statement: ts.Statement): Found | undefined {
	if (ts.isImportDeclaration(statement)) {
		return { kind: "import", node: statement.moduleSpecifier, type: statement.importClause?.isTypeOnly === true };
	}
	if (ts.isExportDeclaration(statement)) {
		return { kind: "import", node: statement.moduleSpecifier, type: statement.isTypeOnly };
	}
	if (ts.isImportEqualsDeclaration(statement) && ts.isExternalModuleReference(statement.moduleReference)) {
		return { kind: "import", node: statement.moduleReference.expression, type: statement.isTypeOnly };
	}
	return undefined;
}

function isRequire(call: ts.CallExpression): boolean {
	return ts.isIdentifier(call.expression) && call.expression.text === "require";
}

function isImportMeta(node: ts.Expression): boolean {
	return ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword && node.name.text === "meta";
}

function resolver(call: ts.CallExpression): "meta" | "require" | undefined {
	const callee = call.expression;
	if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== "resolve") {
		return undefined;
	}
	if (ts.isIdentifier(callee.expression) && callee.expression.text === "require") {
		return "require";
	}
	return isImportMeta(callee.expression) ? "meta" : undefined;
}

// Node resolves a relative import.meta.resolve() by URL arithmetic alone, so the path need not exist.
function isRelative(node: ts.Node | undefined): boolean {
	return node !== undefined && ts.isStringLiteralLike(node) && (node.text.startsWith(".") || node.text.startsWith("/"));
}

function called(call: ts.CallExpression): Found | undefined {
	const [argument] = call.arguments;
	if (call.expression.kind === ts.SyntaxKind.ImportKeyword || isRequire(call)) {
		return { kind: "import", node: argument, type: false };
	}
	const how = resolver(call);
	const checked = how === "require" || (how === "meta" && !isRelative(argument));
	return checked ? { kind: "resolve", node: argument, type: false } : undefined;
}

function nested(node: ts.Node): Found | undefined {
	if (ts.isCallExpression(node)) {
		return called(node);
	}
	if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
		return { kind: "import", node: node.argument.literal, type: true };
	}
	return undefined;
}

function requestOf(source: ts.SourceFile, at: ts.Node, found: Found | undefined): readonly ImportRequest[] {
	if (found?.node === undefined || !ts.isStringLiteralLike(found.node)) {
		return [];
	}
	return [{ kind: found.kind, line: lineAt(source, at.getStart(source)), specifier: found.node.text, type: found.type }];
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

function jsDocRequests(source: ts.SourceFile): readonly ImportRequest[] {
	if (!source.text.includes(JSDOC_IMPORT)) {
		return [];
	}
	const tags = [...source.statements, source.endOfFileToken]
		.flatMap((node) => ts.getJSDocCommentsAndTags(node))
		.flatMap((doc) => (ts.isJSDoc(doc) ? (doc.tags ?? []) : [doc]))
		.filter(ts.isJSDocImportTag);
	return tags.flatMap((tag) => requestOf(source, tag, { kind: "import", node: tag.moduleSpecifier, type: true }));
}

function referenceRequests(source: ts.SourceFile): readonly ImportRequest[] {
	function requestFor(kind: ImportKind): (reference: ts.FileReference) => ImportRequest {
		return (reference) => ({ kind, line: lineAt(source, reference.pos), specifier: reference.fileName, type: true });
	}
	return [...source.typeReferenceDirectives.map(requestFor("type-reference")), ...source.referencedFiles.map(requestFor("path-reference"))];
}

export function importsOf(source: ts.SourceFile, declarationFile: boolean): readonly ImportRequest[] {
	const all = [
		...referenceRequests(source),
		...source.statements.flatMap((statement) => requestOf(source, statement, declared(statement))),
		...jsDocRequests(source),
		...nestedRequests(source),
	];
	return declarationFile ? all.map((request) => ({ ...request, type: true })) : all;
}
