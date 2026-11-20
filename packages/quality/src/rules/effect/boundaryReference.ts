import ts from "typescript";
import type { SourceFile } from "#rule.ts";
import { parse } from "#rules/parse.ts";

function importedReference(declaration: ts.Declaration): string | undefined {
	if (ts.isImportSpecifier(declaration)) {
		const module = declaration.parent.parent.parent.moduleSpecifier;
		return ts.isStringLiteral(module) ? `${module.text}.${(declaration.propertyName ?? declaration.name).text}` : undefined;
	}
	if (ts.isNamespaceImport(declaration) || ts.isImportClause(declaration)) {
		const module = ts.isNamespaceImport(declaration) ? declaration.parent.parent.moduleSpecifier : declaration.parent.moduleSpecifier;
		return ts.isStringLiteral(module) ? module.text : undefined;
	}
	return undefined;
}

function memberName(node: ts.PropertyAccessExpression | ts.ElementAccessExpression): string | undefined {
	if (ts.isPropertyAccessExpression(node)) {
		return node.name.text;
	}
	return ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : undefined;
}

function bindingReference(checker: ts.TypeChecker, declaration: ts.Declaration, seen: Set<ts.Symbol>): string | undefined {
	if (!(ts.isBindingElement(declaration) && ts.isObjectBindingPattern(declaration.parent))) {
		return undefined;
	}
	const variable = declaration.parent.parent;
	const name = declaration.propertyName ?? declaration.name;
	if (!ts.isVariableDeclaration(variable) || variable.initializer === undefined || !(ts.isIdentifier(name) || ts.isStringLiteral(name))) {
		return undefined;
	}
	const owner = boundaryReference(checker, variable.initializer, seen);
	return owner === undefined ? undefined : `${owner}.${name.text}`;
}

function symbolReference(checker: ts.TypeChecker, node: ts.Identifier, seen: Set<ts.Symbol>): string | undefined {
	const symbol = checker.getSymbolAtLocation(node);
	if (symbol === undefined) {
		return node.text;
	}
	if (seen.has(symbol)) {
		return undefined;
	}
	seen.add(symbol);
	for (const declaration of symbol.declarations ?? []) {
		if (ts.isVariableDeclaration(declaration) && declaration.initializer !== undefined) {
			return boundaryReference(checker, declaration.initializer, seen);
		}
		const imported = importedReference(declaration) ?? bindingReference(checker, declaration, seen);
		if (imported !== undefined) {
			return imported;
		}
	}
	return symbol.declarations?.some((declaration) => !declaration.getSourceFile().isDeclarationFile) ? undefined : node.text;
}

export function boundaryReference(checker: ts.TypeChecker, node: ts.Node, seen = new Set<ts.Symbol>()): string | undefined {
	if (ts.isParenthesizedExpression(node)) {
		return boundaryReference(checker, node.expression, seen);
	}
	if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
		const member = memberName(node);
		const owner = boundaryReference(checker, node.expression, seen);
		return owner === undefined || member === undefined ? undefined : `${owner}.${member}`;
	}
	return ts.isIdentifier(node) ? symbolReference(checker, node, seen) : undefined;
}

const ENTRY_NAME = /(?:^|\/)(?:cli|main|entry|[^/]+-cli)\.[cm]?[jt]sx?$/u;

const RUNNER_HOST = /\.(?:config|test|spec)\.[cm]?[jt]sx?$/u;

export function runMainReference(reference: string | undefined): boolean {
	return /^(?:effect|@effect\/[^.]+)(?:\.[A-Za-z]+)?\.runMain$/u.test(reference ?? "");
}

function exported(node: ts.Node): boolean {
	return (
		ts.isExportAssignment(node)
		|| (ts.canHaveModifiers(node) && (ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false))
	);
}

function guard(node: ts.Node, source: ts.SourceFile): boolean {
	if (ts.isPropertyAccessExpression(node)) {
		return ts.isMetaProperty(node.expression) && node.expression.keywordToken === ts.SyntaxKind.ImportKeyword && node.name.text === "main";
	}
	return ts.isBinaryExpression(node) && node.getText(source).replace(/\s/gu, "") === "fileURLToPath(import.meta.url)===process.argv[1]";
}

// A module runs as a program when runMain starts at its top level or a main-module guard picks it; a runMain inside a function or an export is a helper that hides a runner.
export function entryModule(path: string, source: ts.SourceFile, checker: ts.TypeChecker): boolean {
	if (RUNNER_HOST.test(path)) {
		return false;
	}
	if (ENTRY_NAME.test(path)) {
		return true;
	}
	function runsMain(node: ts.Node): boolean {
		if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "runMain") {
			return true;
		}
		const named = (ts.isPropertyAccessExpression(node) && node.name.text === "runMain") || (ts.isIdentifier(node) && node.text === "runMain");
		return named && (boundaryReference(checker, node)?.endsWith(".runMain") ?? false);
	}
	function visit(node: ts.Node): boolean {
		if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
			return false;
		}
		if (ts.isFunctionLike(node) || exported(node)) {
			return guarded(node);
		}
		return runsMain(node) || guard(node, source) || (ts.forEachChild(node, visit) ?? false);
	}
	function guarded(node: ts.Node): boolean {
		return guard(node, source) || (ts.forEachChild(node, guarded) ?? false);
	}
	return visit(source);
}

export function boundaryEntryPoint(path: string, source: ts.SourceFile, checker: ts.TypeChecker): boolean {
	return RUNNER_HOST.test(path) || entryModule(path, source, checker);
}

// Imports name their modules, so each module binds on its own without resolving the program behind it: local names resolve, imports stay unresolved.
export function moduleBinder(sources: readonly SourceFile[]) {
	const options: ts.CompilerOptions = { allowJs: true, noLib: true, noResolve: true, types: [] };
	const host = ts.createCompilerHost(options);
	const parsed = new Map(
		sources.flatMap((file) => {
			const source = parse(file);
			return source === undefined ? [] : [[file.path, source] as const];
		}),
	);
	const named = new Map([...parsed.values()].map((source) => [source.fileName, source]));
	host.getSourceFile = (name) => named.get(name);
	host.resolveModuleNameLiterals = (literals) => literals.map(() => ({ resolvedModule: undefined }));
	return { checker: ts.createProgram([...named.keys()], options, host).getTypeChecker(), parsed };
}

export function entryModules(sources: readonly SourceFile[]): ReadonlySet<string> {
	const { checker, parsed } = moduleBinder(sources);
	return new Set([...parsed].flatMap(([path, source]) => (entryModule(path, source, checker) ? [path] : [])));
}
