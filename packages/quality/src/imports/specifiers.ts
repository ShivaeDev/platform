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
	return undefined;
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

const JSDOC_IMPORT = /@import\b[^"'`]*?\bfrom\s*(?<quote>["'])(?<path>[^"'\r\n]*)\k<quote>/gu;

function siteAt(source: ts.SourceFile, start: number, specifier: string): SpecifierSite {
	return { end: start + specifier.length, line: source.getLineAndCharacterOfPosition(start).line + 1, specifier, start, type: true };
}

// A node keeps only its last JSDoc block, so @import tags are read from every comment before it.
function jsDocImports(source: ts.SourceFile, node: ts.Node, seen: Set<number>): readonly SpecifierSite[] {
	return (ts.getLeadingCommentRanges(source.text, node.pos) ?? []).flatMap((range) => {
		const comment = source.text.slice(range.pos, range.end);
		if (seen.has(range.pos) || !comment.startsWith("/**")) {
			return [];
		}
		seen.add(range.pos);
		return [...comment.matchAll(JSDOC_IMPORT)].map((match) => {
			const path = match.groups?.path ?? "";
			return siteAt(source, range.pos + match.index + match[0].length - path.length - 1, path);
		});
	});
}

export function specifierSites(source: ts.SourceFile): readonly SpecifierSite[] {
	const sites: SpecifierSite[] = [];
	const nested = MAY_CALL.test(source.text);
	const documented = source.text.includes("@import");
	const comments = new Set<number>();
	function visit(node: ts.Node): void {
		sites.push(...siteOf(source, declared(node) ?? (nested ? called(node) : undefined)));
		if (documented) {
			sites.push(...jsDocImports(source, node, comments));
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return [...new Map(sites.map((site) => [site.start, site])).values()].sort((left, right) => left.start - right.start);
}
