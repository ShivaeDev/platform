import { posix } from "node:path";
import { Effect } from "effect";
import ts from "typescript";
import { specifierSites } from "#imports/specifiers.ts";
import { packageOf, type WorkspacePackage } from "#imports/workspace.ts";
import { readPackageManifest } from "#manifestInventory.ts";
import { DEPENDENCY_FIELDS, dependencyNames, isApplication } from "#manifests/entryPoints.ts";
import { isTestCode } from "#naming/testName.ts";
import type { Finding, RuleInputs, SourceFile } from "#rule.ts";
import { parse } from "#rules/parse.ts";

type Message = (statement: ts.Statement | undefined) => string | undefined;

interface Replacement {
	readonly dependency?: string;
	readonly message: Message;
	readonly specifier: string;
}

const BARREL = "@effect/platform-node";

function barrelSubpaths(statement: ts.Statement | undefined): readonly string[] | undefined {
	const bindings = statement !== undefined && ts.isImportDeclaration(statement) ? statement.importClause?.namedBindings : undefined;
	if (bindings !== undefined && ts.isNamedImports(bindings)) {
		const values = bindings.elements.filter((element) => !element.isTypeOnly);
		return values.length === 0 && bindings.elements.length > 0
			? undefined
			: values.map((element) => `${BARREL}/${(element.propertyName ?? element.name).text}`);
	}
	if (
		statement !== undefined
		&& ts.isExportDeclaration(statement)
		&& statement.exportClause !== undefined
		&& ts.isNamedExports(statement.exportClause)
		&& statement.exportClause.elements.every((element) => element.isTypeOnly)
	) {
		return undefined;
	}
	return [];
}

function barrel(statement: ts.Statement | undefined): string | undefined {
	const paths = barrelSubpaths(statement);
	if (paths === undefined) {
		return undefined;
	}
	return `The ${BARREL} barrel loads optional integrations such as redis. Import module subpaths instead: ${paths.length > 0 ? paths.map((path) => `\`import * as ${path.slice(path.lastIndexOf("/") + 1)} from "${path}"\``).join("; ") : `\`import * as NodeServices from "${BARREL}/NodeServices"\` (choose the module you use)`}.`;
}

function namedValues(statement: ts.Statement | undefined): readonly string[] {
	if (statement !== undefined && ts.isImportDeclaration(statement)) {
		const bindings = statement.importClause?.isTypeOnly === true ? undefined : statement.importClause?.namedBindings;
		return bindings !== undefined && ts.isNamedImports(bindings)
			? bindings.elements.filter((element) => !element.isTypeOnly).map((element) => (element.propertyName ?? element.name).text)
			: [];
	}
	if (statement !== undefined && ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
		const clause = statement.exportClause;
		return clause !== undefined && ts.isNamedExports(clause)
			? clause.elements.filter((element) => !element.isTypeOnly).map((element) => (element.propertyName ?? element.name).text)
			: [];
	}
	return [];
}

function named(name: string, message: string): Message {
	return (statement) => (namedValues(statement).includes(name) ? message : undefined);
}

const REPLACEMENTS: readonly Replacement[] = [
	{ message: barrel, specifier: BARREL },
	{
		dependency: "@shivaedev/react",
		message: named(
			"RouterProvider",
			"TanStack Router's RouterProvider does not tell useFirstSettled when the first route has rendered, so a first screen it holds is revealed onto loading states. Mount the react package's provider instead, which takes the same props: `import { RouterProvider } from \"@shivaedev/react/RouterProvider.ts\"`.",
		),
		specifier: "@tanstack/react-router",
	},
];

function fileFindings(file: SourceFile, dependsOn: (name: string) => boolean): readonly Finding[] {
	const source = isTestCode(file.path) ? undefined : parse(file);
	if (source === undefined || source.isDeclarationFile) {
		return [];
	}
	return specifierSites(source).flatMap((site) => {
		const replacement = REPLACEMENTS.find((candidate) => candidate.specifier === site.specifier);
		if (site.type || replacement === undefined || (replacement.dependency !== undefined && !dependsOn(replacement.dependency))) {
			return [];
		}
		const message = replacement.message(source.statements.find((node) => node.pos <= site.start && node.end > site.start));
		return message === undefined ? [] : [{ file: file.path, line: site.line, message, subject: replacement.specifier }];
	});
}

// An application gets every framework piece through the platform shell, so it depends on each of them.
function dependencies(manifest: unknown): (name: string) => boolean {
	return (name) => isApplication(manifest) || DEPENDENCY_FIELDS.some((field) => dependencyNames(manifest, field).includes(name));
}

export const replacementImports = Effect.fn("Imports.replacementImports")(function* (inputs: RuleInputs, packages: readonly WorkspacePackage[]) {
	const owners = [...packages, { directory: ".", name: "." }];
	const manifests = new Map(
		yield* Effect.forEach(owners, (owner) =>
			Effect.map(
				readPackageManifest(inputs.readText, posix.join(owner.directory, "package.json")),
				(manifest) => [owner.directory, manifest] as const,
			),
		),
	);
	return inputs.sources.flatMap((file) => fileFindings(file, dependencies(manifests.get(packageOf(packages, file.path)?.directory ?? "."))));
});
