import ts from "typescript";

const FS_MODULES: ReadonlySet<string> = new Set(["fs", "fs/promises", "node:fs", "node:fs/promises"]);
const FIXTURE_WRITES: ReadonlySet<string> = new Set([
	"appendFile",
	"appendFileSync",
	"copyFile",
	"copyFileSync",
	"cp",
	"cpSync",
	"mkdir",
	"mkdirSync",
	"mkdtemp",
	"mkdtempSync",
	"symlink",
	"symlinkSync",
	"writeFile",
	"writeFileSync",
]);

interface FsBindings {
	readonly functions: ReadonlyMap<string, string>;
	readonly namespaces: ReadonlySet<string>;
}

export interface FixtureWrite {
	readonly call: ts.CallExpression;
	readonly name: string;
}

function fsImportsOf(source: ts.SourceFile): readonly ts.ImportClause[] {
	return source.statements.flatMap((statement) =>
		ts.isImportDeclaration(statement)
		&& ts.isStringLiteral(statement.moduleSpecifier)
		&& FS_MODULES.has(statement.moduleSpecifier.text)
		&& statement.importClause !== undefined
			? [statement.importClause]
			: [],
	);
}

function addBindings(clause: ts.ImportClause, functions: Map<string, string>, namespaces: Set<string>): void {
	const bindings = clause.namedBindings;
	for (const local of [clause.name, bindings !== undefined && ts.isNamespaceImport(bindings) ? bindings.name : undefined]) {
		if (local !== undefined) {
			namespaces.add(local.text);
		}
	}
	for (const element of bindings !== undefined && ts.isNamedImports(bindings) ? bindings.elements : []) {
		const imported = (element.propertyName ?? element.name).text;
		if (imported === "promises") {
			namespaces.add(element.name.text);
		} else if (FIXTURE_WRITES.has(imported)) {
			functions.set(element.name.text, imported);
		}
	}
}

function fsBindingsOf(source: ts.SourceFile): FsBindings {
	const functions = new Map<string, string>();
	const namespaces = new Set<string>();
	for (const clause of fsImportsOf(source)) {
		addBindings(clause, functions, namespaces);
	}
	return { functions, namespaces };
}

function isFsNamespace(node: ts.Expression, bindings: FsBindings): boolean {
	return (
		(ts.isIdentifier(node) && bindings.namespaces.has(node.text))
		|| (ts.isPropertyAccessExpression(node) && node.name.text === "promises" && isFsNamespace(node.expression, bindings))
	);
}

function fixtureWriteOf(callee: ts.Expression, bindings: FsBindings): string | undefined {
	if (ts.isIdentifier(callee)) {
		return bindings.functions.get(callee.text);
	}
	if (ts.isPropertyAccessExpression(callee) && FIXTURE_WRITES.has(callee.name.text) && isFsNamespace(callee.expression, bindings)) {
		return callee.name.text;
	}
	return undefined;
}

export function fixtureWrites(source: ts.SourceFile): readonly FixtureWrite[] {
	const bindings = fsBindingsOf(source);
	if (bindings.functions.size === 0 && bindings.namespaces.size === 0) {
		return [];
	}
	const writes: FixtureWrite[] = [];
	function visit(node: ts.Node): void {
		if (ts.isCallExpression(node)) {
			const name = fixtureWriteOf(node.expression, bindings);
			if (name !== undefined) {
				writes.push({ call: node, name });
			}
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return writes;
}
