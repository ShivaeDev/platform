import ts from "typescript";

export interface SpecifierSite {
	readonly end: number;
	readonly line: number;
	readonly specifier: string;
	readonly start: number;
	readonly type: boolean;
}

interface Found {
	readonly node: ts.Node | undefined;
	readonly type: boolean;
}

const MOCKS = new Set(["doMock", "doUnmock", "importActual", "importMock", "mock", "unmock"]);

const MAY_CALL = /\b(?:import|require)\s*\(|\bvi\s*\.\s*(?:doMock|doUnmock|importActual|importMock|mock|unmock)\b/u;

function declared(node: ts.Node): Found | undefined {
	if (ts.isImportDeclaration(node)) {
		return { node: node.moduleSpecifier, type: node.importClause?.isTypeOnly === true };
	}
	if (ts.isExportDeclaration(node)) {
		return { node: node.moduleSpecifier, type: node.isTypeOnly };
	}
	if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
		return { node: node.moduleReference.expression, type: node.isTypeOnly };
	}
	return ts.isJSDocImportTag(node) ? { node: node.moduleSpecifier, type: true } : undefined;
}

function isMock(callee: ts.Expression): boolean {
	return (
		ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === "vi" && MOCKS.has(callee.name.text)
	);
}

function called(node: ts.Node): Found | undefined {
	if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
		return { node: node.argument.literal, type: true };
	}
	if (!ts.isCallExpression(node)) {
		return undefined;
	}
	const callee = node.expression;
	const loads = callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === "require") || isMock(callee);
	return loads ? { node: node.arguments[0], type: false } : undefined;
}

// Only a literal whose source spells exactly its text is rewritten, so an escape or a template expression is left alone.
function siteOf(source: ts.SourceFile, found: Found | undefined): readonly SpecifierSite[] {
	const literal = found?.node;
	if (found === undefined || literal === undefined || !ts.isStringLiteralLike(literal)) {
		return [];
	}
	const start = literal.getStart(source) + 1;
	const end = literal.end - 1;
	if (source.text.slice(start, end) !== literal.text) {
		return [];
	}
	return [{ end, line: source.getLineAndCharacterOfPosition(start).line + 1, specifier: literal.text, start, type: found.type }];
}

function jsDocNodes(node: ts.Node): readonly ts.Node[] {
	return ts.getJSDocCommentsAndTags(node).flatMap((doc) => (ts.isJSDoc(doc) ? (doc.tags ?? []) : [doc]));
}

export function specifierSites(source: ts.SourceFile): readonly SpecifierSite[] {
	const sites: SpecifierSite[] = [];
	const nested = MAY_CALL.test(source.text);
	const documented = source.text.includes("@import");
	function visit(node: ts.Node): void {
		sites.push(...siteOf(source, declared(node) ?? (nested ? called(node) : undefined)));
		if (documented) {
			sites.push(...jsDocNodes(node).flatMap((tag) => siteOf(source, declared(tag))));
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return [...new Map(sites.map((site) => [site.start, site])).values()].sort((left, right) => left.start - right.start);
}
