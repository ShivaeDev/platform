import ts from "typescript";

export interface Stand {
	readonly line: number;
	readonly what: string;
	readonly why: "mocks" | "provides";
}

const MOCKS: ReadonlySet<string> = new Set([
	"doMock",
	"fn",
	"hoisted",
	"importActual",
	"importMock",
	"mock",
	"mocked",
	"mockObject",
	"setSystemTime",
	"spyOn",
	"stubEnv",
	"stubGlobal",
	"useFakeTimers",
]);

const VITEST: ReadonlySet<string> = new Set(["vitest", "@effect/vitest"]);

const EFFECT_MODULE = /^effect\/(?<name>[A-Z]\w*)$/u;

interface Name {
	readonly module: string;
	readonly path: readonly string[];
}

function bindingOf(module: string, imported: readonly string[]): Name {
	const name = EFFECT_MODULE.exec(module)?.groups?.name;
	return name === undefined ? { module, path: imported } : { module: "effect", path: [name, ...imported] };
}

function importsOf(source: ts.SourceFile): ReadonlyMap<string, Name> {
	const bound = new Map<string, Name>();
	for (const statement of source.statements) {
		if (!(ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier))) {
			continue;
		}
		const module = statement.moduleSpecifier.text;
		const bindings = statement.importClause?.namedBindings;
		if (bindings !== undefined && ts.isNamespaceImport(bindings)) {
			bound.set(bindings.name.text, bindingOf(module, []));
		}
		for (const element of bindings !== undefined && ts.isNamedImports(bindings) ? bindings.elements : []) {
			bound.set(element.name.text, bindingOf(module, [(element.propertyName ?? element.name).text]));
		}
	}
	return bound;
}

function qualified(node: ts.Expression, bound: ReadonlyMap<string, Name>): Name | undefined {
	if (ts.isIdentifier(node)) {
		return bound.get(node.text) ?? (node.text === "vi" ? { module: "vitest", path: ["vi"] } : undefined);
	}
	const receiver = ts.isPropertyAccessExpression(node) ? qualified(node.expression, bound) : undefined;
	return receiver === undefined || !ts.isPropertyAccessExpression(node) ? undefined : { ...receiver, path: [...receiver.path, node.name.text] };
}

function standOf({ module, path }: Name): Stand["why"] | undefined {
	const [head = "", member = "", ...rest] = path;
	if (rest.length > 0) {
		return undefined;
	}
	if (VITEST.has(module) && head === "vi" && MOCKS.has(member)) {
		return "mocks";
	}
	if (module === "@effect/vitest" && ((head === "layer" && member === "") || (head === "it" && member === "layer"))) {
		return "provides";
	}
	const provides = (head === "Effect" && member.startsWith("provide")) || ((head === "Layer" || head === "ManagedRuntime") && member !== "");
	return module === "effect" && provides ? "provides" : undefined;
}

export function standIns(source: ts.SourceFile): readonly Stand[] {
	const bound = importsOf(source);
	const found = new Map<string, Stand>();
	function visit(node: ts.Node): void {
		const called = ts.isIdentifier(node) && ts.isCallExpression(node.parent) && node.parent.expression === node;
		const name = ts.isPropertyAccessExpression(node) || (called && ts.isIdentifier(node)) ? qualified(node, bound) : undefined;
		const why = name === undefined ? undefined : standOf(name);
		const key = name === undefined ? "" : `${name.module}#${name.path.join(".")}`;
		if (why !== undefined && !found.has(key)) {
			found.set(key, { line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, what: node.getText(source), why });
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return [...found.values()];
}
