import ts from "typescript";
import { type ExportedVariable, exportedVariables, exportsAnything } from "#exportedVariables.ts";
import type { FileRegistrations } from "#registrations.ts";

const CLIENT_MODULE = "@shivaedev/react/client/module.ts";

interface ClientModuleNames {
	readonly named: ReadonlySet<string>;
	readonly namespaces: ReadonlySet<string>;
}

function clientModuleNames(source: ts.SourceFile): ClientModuleNames {
	const bindings = source.statements.flatMap((statement) =>
		ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === CLIENT_MODULE
			? (statement.importClause?.namedBindings ?? [])
			: [],
	);
	return {
		named: new Set(
			bindings
				.flatMap((binding) => (ts.isNamedImports(binding) ? binding.elements : []))
				.filter((element) => (element.propertyName ?? element.name).text === "clientModule")
				.map((element) => element.name.text),
		),
		namespaces: new Set(bindings.flatMap((binding) => (ts.isNamespaceImport(binding) ? [binding.name.text] : []))),
	};
}

function callsClientModule(expression: ts.Expression | undefined, names: ClientModuleNames): boolean {
	if (expression === undefined) {
		return false;
	}
	if (ts.isParenthesizedExpression(expression) || ts.isSatisfiesExpression(expression)) {
		return callsClientModule(expression.expression, names);
	}
	if (!ts.isCallExpression(expression)) {
		return false;
	}
	const callee = expression.expression;
	return ts.isIdentifier(callee)
		? names.named.has(callee.text)
		: ts.isPropertyAccessExpression(callee)
				&& ts.isIdentifier(callee.expression)
				&& names.namespaces.has(callee.expression.text)
				&& callee.name.text === "clientModule";
}

export function isClientModuleFile(file: string): boolean {
	return /[\\/]modules[\\/].+[\\/]client[\\/]module\.tsx?$/u.test(file);
}

// Server code never reaches the browser bundle, so the client's list must never import a file under a server folder.
function isServerPath(file: string): boolean {
	return /(?:^|[\\/])server[\\/]/u.test(file);
}

export function clientModulesIn(source: ts.SourceFile): Omit<FileRegistrations, "file"> {
	const names = clientModuleNames(source);
	const found = exportedVariables(source)
		.filter(({ variable }: ExportedVariable) => callsClientModule(variable.initializer, names))
		.map(({ name }) => name);
	if (found.length > 0 && isServerPath(source.fileName)) {
		return {
			refusals: [
				`exports ${found.join(", ")} built by clientModule in server code, which the client's module list never imports; move it to the module's client/module.tsx`,
			],
			registrations: [],
		};
	}
	const unfound = found.length === 0 && isClientModuleFile(source.fileName) && exportsAnything(source);
	return {
		refusals: unfound
			? [
					`exports no client module, so the client's module list leaves its module out; export the module as a const built by clientModule from ${CLIENT_MODULE}`,
				]
			: [],
		registrations: found,
	};
}
