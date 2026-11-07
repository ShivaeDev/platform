import ts from "typescript";
import { moduleResolver } from "#adapters/moduleResolver.ts";

export type ImportKind = "import" | "path-reference" | "resolve" | "type-reference";

export interface ImportRequest {
	readonly kind: ImportKind;
	readonly line: number;
	readonly mode?: ts.ResolutionMode;
	readonly specifier: string;
	readonly type: boolean;
}

interface Found {
	readonly kind: ImportKind;
	readonly node: ts.Node | undefined;
	readonly type: boolean;
}

const MAY_CALL = /\b(?:import|require)\s*\(|\b(?:require|import\.meta)\.resolve\s*\(|\bcreateRequire\b/u;

const JSDOC_IMPORT = "@import";

function lineAt(source: ts.SourceFile, position: number): number {
	return source.getLineAndCharacterOfPosition(position).line + 1;
}

function typeBindings(bindings: ts.NamedImportBindings | ts.NamedExportBindings | undefined, defaultName?: ts.Identifier): boolean {
	return (
		defaultName === undefined
		&& bindings !== undefined
		&& (ts.isNamedImports(bindings) || ts.isNamedExports(bindings))
		&& bindings.elements.length > 0
		&& bindings.elements.every((element) => element.isTypeOnly)
	);
}

function declared(statement: ts.Statement): Found | undefined {
	if (ts.isImportDeclaration(statement)) {
		return {
			kind: "import",
			node: statement.moduleSpecifier,
			type: statement.importClause?.isTypeOnly === true || typeBindings(statement.importClause?.namedBindings, statement.importClause?.name),
		};
	}
	if (ts.isExportDeclaration(statement)) {
		return { kind: "import", node: statement.moduleSpecifier, type: statement.isTypeOnly || typeBindings(statement.exportClause) };
	}
	if (ts.isImportEqualsDeclaration(statement) && ts.isExternalModuleReference(statement.moduleReference)) {
		return { kind: "import", node: statement.moduleReference.expression, type: statement.isTypeOnly };
	}
	return undefined;
}

function isRequire(call: ts.CallExpression): boolean {
	return ts.isIdentifier(call.expression) && call.expression.text === "require";
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
	const how = moduleResolver(call);
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

function requestOf(source: ts.SourceFile, at: ts.Node, found: Found | undefined, options?: ts.CompilerOptions): readonly ImportRequest[] {
	if (found?.node === undefined || !ts.isStringLiteralLike(found.node)) {
		return [];
	}
	const mode = options === undefined ? {} : { mode: ts.getModeForUsageLocation(source, found.node, options) };
	return [{ ...mode, kind: found.kind, line: lineAt(source, at.getStart(source)), specifier: found.node.text, type: found.type }];
}

function nestedRequests(source: ts.SourceFile, options?: ts.CompilerOptions): readonly ImportRequest[] {
	if (!MAY_CALL.test(source.text)) {
		return [];
	}
	const requests: ImportRequest[] = [];
	function visit(node: ts.Node): void {
		requests.push(...requestOf(source, node, nested(node), options));
		ts.forEachChild(node, visit);
	}
	visit(source);
	return requests;
}

function jsDocRequests(source: ts.SourceFile, options?: ts.CompilerOptions): readonly ImportRequest[] {
	if (!source.text.includes(JSDOC_IMPORT)) {
		return [];
	}
	const tags = [...source.statements, source.endOfFileToken]
		.flatMap((node) => ts.getJSDocCommentsAndTags(node))
		.flatMap((doc) => (ts.isJSDoc(doc) ? (doc.tags ?? []) : [doc]))
		.filter(ts.isJSDocImportTag);
	return tags.flatMap((tag) => requestOf(source, tag, { kind: "import", node: tag.moduleSpecifier, type: true }, options));
}

function referenceRequests(source: ts.SourceFile): readonly ImportRequest[] {
	function requestFor(kind: ImportKind): (reference: ts.FileReference) => ImportRequest {
		return (reference) => ({ kind, line: lineAt(source, reference.pos), specifier: reference.fileName, type: true });
	}
	return [...source.typeReferenceDirectives.map(requestFor("type-reference")), ...source.referencedFiles.map(requestFor("path-reference"))];
}

export function importsOf(source: ts.SourceFile, declarationFile: boolean, options?: ts.CompilerOptions): readonly ImportRequest[] {
	const all = [
		...referenceRequests(source),
		...source.statements.flatMap((statement) => requestOf(source, statement, declared(statement), options)),
		...jsDocRequests(source, options),
		...nestedRequests(source, options),
	];
	return declarationFile ? all.map((request) => ({ ...request, type: true })) : all;
}
