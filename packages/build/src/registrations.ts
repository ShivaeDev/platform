import ts from "typescript";
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

export function isServerPath(file: string): boolean {
	return /(?:^|[\\/])server[\\/]/u.test(file);
}

// Services are optional, so a registration is known by what it serves: a group and its handlers, or a `module` beside another
// registration part. Browser code may hold a module too, so a `module` alone counts only as a reference in a server folder.
function namesModule(literal: ts.ObjectLiteralExpression, inServerCode: boolean, parts: readonly string[]): boolean {
	const property = propertyOf(literal, "module");
	if (property === undefined) {
		return false;
	}
	const module = initializerOf(property);
	const refersToModule = module !== undefined && (ts.isIdentifier(module) || ts.isPropertyAccessExpression(module));
	return parts.some((part) => propertyOf(literal, part) !== undefined) || (inServerCode && refersToModule);
}

function registrationObject(expression: ts.Expression | undefined): ts.ObjectLiteralExpression | undefined {
	const inner = withoutParentheses(expression);
	if (inner !== undefined && ts.isAsExpression(inner)) {
		return registrationObject(inner.expression);
	}
	return inner !== undefined && ts.isObjectLiteralExpression(inner) ? inner : undefined;
}

function looksLikeRegistration(literal: ts.ObjectLiteralExpression, inServerCode: boolean, parts: readonly string[]): boolean {
	return namesModule(literal, inServerCode, parts) || (propertyOf(literal, "group") !== undefined && propertyOf(literal, "handlers") !== undefined);
}

type Found = { readonly refusal: string } | { readonly registration: string };

interface Reading {
	readonly inServerCode: boolean;
	readonly names: AppModuleNames;
	readonly parts: readonly string[];
}

function foundIn({ name, variable }: ExportedVariable, { inServerCode, names, parts }: Reading): readonly Found[] {
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
	const literal = registrationObject(initializer);
	if (literal === undefined) {
		return [];
	}
	if (looksLikeRegistration(literal, inServerCode, parts)) {
		return [
			{
				refusal: `${name} names what it serves but is not written \`satisfies AppModule\`, so the server's module list leaves it out; write \`satisfies AppModule\` after its object, with AppModule imported from ${APP_MODULE}`,
			},
		];
	}
	const part = inServerCode ? parts.find((each) => propertyOf(literal, each) !== undefined) : undefined;
	return part === undefined
		? []
		: [
				{
					refusal: `${name} carries ${part}, a part of a registration, but is not written \`satisfies AppModule\`, so the server's module list leaves it out; write \`satisfies AppModule\` after its object, with AppModule imported from ${APP_MODULE}, or, when it is no registration, rename its ${part} key or stop exporting it`,
				},
			];
}

export function isModuleRegistrationFile(file: string): boolean {
	return /[\\/]modules[\\/].+[\\/]server[\\/]registration\.tsx?$/u.test(file);
}

export function registrationsIn(source: ts.SourceFile, parts: readonly string[]): Omit<FileRegistrations, "file"> {
	const reading: Reading = { inServerCode: isServerPath(source.fileName), names: appModuleNames(source), parts };
	const found = exportedVariables(source).flatMap((exported) => foundIn(exported, reading));
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
