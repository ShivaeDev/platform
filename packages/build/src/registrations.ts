import ts from "typescript";
import { byText } from "#byText.ts";
import { type ExportedVariable, exportedVariables, exportsAnything } from "#exportedVariables.ts";
import { initializerOf, propertyOf } from "#moduleCalls.ts";

const APP_MODULE = "@shivaedev/server/AppModule.ts";

export interface FileRegistrations {
	readonly file: string;
	readonly refusals: readonly string[];
	readonly registrations: readonly string[];
}

interface AppModuleNames {
	readonly named: ReadonlySet<string>;
	readonly namespaces: ReadonlySet<string>;
}

function appModuleImport(statement: ts.Statement): ts.NamedImportBindings | undefined {
	return ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === APP_MODULE
		? statement.importClause?.namedBindings
		: undefined;
}

function appModuleNames(source: ts.SourceFile): AppModuleNames {
	const bindings = source.statements.flatMap((statement) => appModuleImport(statement) ?? []);
	return {
		named: new Set(
			bindings
				.flatMap((binding) => (ts.isNamedImports(binding) ? binding.elements : []))
				.filter((element) => (element.propertyName ?? element.name).text === "AppModule")
				.map((element) => element.name.text),
		),
		namespaces: new Set(bindings.flatMap((binding) => (ts.isNamespaceImport(binding) ? [binding.name.text] : []))),
	};
}

function namesAppModule(type: ts.TypeNode | undefined, names: AppModuleNames): boolean {
	if (type === undefined || !ts.isTypeReferenceNode(type)) {
		return false;
	}
	const { typeName } = type;
	return ts.isIdentifier(typeName)
		? names.named.has(typeName.text)
		: ts.isIdentifier(typeName.left) && names.namespaces.has(typeName.left.text) && typeName.right.text === "AppModule";
}

function withoutParentheses(expression: ts.Expression | undefined): ts.Expression | undefined {
	return expression !== undefined && ts.isParenthesizedExpression(expression) ? withoutParentheses(expression.expression) : expression;
}

// Services are optional, so a registration is known by what it serves: a `module` it refers to, or a group and its handlers. One
// that serves only admin pages, queues or workers looks like any other object, so only `satisfies AppModule` lists it.
function namesModule(literal: ts.ObjectLiteralExpression): boolean {
	const module = initializerOf(propertyOf(literal, "module"));
	return module !== undefined && (ts.isIdentifier(module) || ts.isPropertyAccessExpression(module));
}

function looksLikeRegistration(expression: ts.Expression | undefined): boolean {
	const inner = withoutParentheses(expression);
	if (inner !== undefined && ts.isAsExpression(inner)) {
		return looksLikeRegistration(inner.expression);
	}
	return (
		inner !== undefined
		&& ts.isObjectLiteralExpression(inner)
		&& (namesModule(inner) || (propertyOf(inner, "group") !== undefined && propertyOf(inner, "handlers") !== undefined))
	);
}

type Found = { readonly refusal: string } | { readonly registration: string };

function foundIn({ name, variable }: ExportedVariable, names: AppModuleNames): readonly Found[] {
	const initializer = withoutParentheses(variable.initializer);
	if (initializer !== undefined && ts.isSatisfiesExpression(initializer)) {
		return namesAppModule(initializer.type, names) ? [{ registration: name }] : [];
	}
	const cast = initializer !== undefined && ts.isAsExpression(initializer) && namesAppModule(initializer.type, names);
	if (namesAppModule(variable.type, names) || cast) {
		return [
			{
				refusal: `${name} is typed as AppModule, which leaves it out of the server's module list and loses its module's services; write \`satisfies AppModule\` after its object instead`,
			},
		];
	}
	return looksLikeRegistration(initializer)
		? [
				{
					refusal: `${name} names what it serves but is not written \`satisfies AppModule\`, so the server's module list leaves it out; write \`satisfies AppModule\` after its object, with AppModule imported from ${APP_MODULE}`,
				},
			]
		: [];
}

export function isModuleRegistrationFile(file: string): boolean {
	return /[\\/]modules[\\/].+[\\/]server[\\/]registration\.tsx?$/u.test(file);
}

export function registrationsIn(source: ts.SourceFile): Omit<FileRegistrations, "file"> {
	const names = appModuleNames(source);
	const found = exportedVariables(source).flatMap((exported) => foundIn(exported, names));
	const refusals = found.flatMap((each) => ("refusal" in each ? [each.refusal] : []));
	const registrations = found.flatMap((each) => ("registration" in each ? [each.registration] : []));
	const unfound = found.length === 0 && isModuleRegistrationFile(source.fileName) && exportsAnything(source);
	return {
		refusals: unfound
			? [
					`exports no registration written \`satisfies AppModule\`, so the server's module list leaves its module out; export the registration as a const written \`satisfies AppModule\`, with AppModule imported from ${APP_MODULE}`,
				]
			: refusals,
		registrations,
	};
}

// Takes the path under the project, as isModuleRegistrationFile does, so no folder the checkout sits in decides. Test files and
// kits may build registrations of their own, which the server's list must never serve.
export function mayRegister(file: string): boolean {
	return !(/[\\/]test-support[\\/]/u.test(file) || /\.(?:test|spec)\.tsx?$/u.test(file));
}

export interface ListEntry {
	readonly file: string;
	readonly name: string;
}

export function inPathOrder(found: readonly FileRegistrations[]): readonly ListEntry[] {
	return [...found]
		.sort((left, right) => byText(left.file, right.file))
		.flatMap(({ file, registrations }) => registrations.map((name) => ({ file, name })));
}
