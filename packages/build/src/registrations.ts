import ts from "typescript";
import { byText } from "#byText.ts";
import { propertyOf } from "#moduleCalls.ts";

const APP_MODULE = "@shivaedev/server/AppModule.ts";

export interface FileRegistrations {
	readonly file: string;
	readonly refusals: readonly string[];
	readonly registrations: readonly string[];
}

function appModuleImports(statement: ts.Statement): readonly ts.ImportSpecifier[] {
	if (!(ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === APP_MODULE)) {
		return [];
	}
	const bindings = statement.importClause?.namedBindings;
	return bindings !== undefined && ts.isNamedImports(bindings) ? bindings.elements : [];
}

function appModuleNames(source: ts.SourceFile): ReadonlySet<string> {
	return new Set(
		source.statements
			.flatMap(appModuleImports)
			.filter((element) => (element.propertyName ?? element.name).text === "AppModule")
			.map((element) => element.name.text),
	);
}

function namesAppModule(type: ts.TypeNode | undefined, locals: ReadonlySet<string>): boolean {
	return type !== undefined && ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName) && locals.has(type.typeName.text);
}

function withoutParentheses(expression: ts.Expression | undefined): ts.Expression | undefined {
	return expression !== undefined && ts.isParenthesizedExpression(expression) ? withoutParentheses(expression.expression) : expression;
}

// A registration names the module it serves and its services, so an object with both that is not written `satisfies AppModule`
// is one the list would leave out without a word.
function looksLikeRegistration(expression: ts.Expression | undefined): boolean {
	const inner = withoutParentheses(expression);
	if (inner !== undefined && ts.isAsExpression(inner)) {
		return looksLikeRegistration(inner.expression);
	}
	return (
		inner !== undefined
		&& ts.isObjectLiteralExpression(inner)
		&& propertyOf(inner, "module") !== undefined
		&& propertyOf(inner, "services") !== undefined
	);
}

type Found = { readonly refusal: string } | { readonly registration: string };

function foundIn(variable: ts.VariableDeclaration, locals: ReadonlySet<string>): readonly Found[] {
	const initializer = withoutParentheses(variable.initializer);
	if (!ts.isIdentifier(variable.name)) {
		return [];
	}
	const name = variable.name.text;
	if (initializer !== undefined && ts.isSatisfiesExpression(initializer)) {
		return namesAppModule(initializer.type, locals) ? [{ registration: name }] : [];
	}
	const cast = initializer !== undefined && ts.isAsExpression(initializer) && namesAppModule(initializer.type, locals);
	if (namesAppModule(variable.type, locals) || cast) {
		return [
			{
				refusal: `${name} is typed as AppModule, which leaves it out of the server's module list and loses its module's services; write \`satisfies AppModule\` after its object instead`,
			},
		];
	}
	return looksLikeRegistration(initializer)
		? [
				{
					refusal: `${name} names a module and its services but is not written \`satisfies AppModule\`, so the server's module list leaves it out; write \`satisfies AppModule\` after its object, with AppModule imported from ${APP_MODULE}`,
				},
			]
		: [];
}

function exportedVariables(statement: ts.Statement): readonly ts.VariableDeclaration[] {
	const exported =
		ts.isVariableStatement(statement) && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) === true;
	return exported ? statement.declarationList.declarations : [];
}

export function registrationsIn(source: ts.SourceFile): Omit<FileRegistrations, "file"> {
	const locals = appModuleNames(source);
	const found = source.statements.flatMap(exportedVariables).flatMap((variable) => foundIn(variable, locals));
	return {
		refusals: found.flatMap((each) => ("refusal" in each ? [each.refusal] : [])),
		registrations: found.flatMap((each) => ("registration" in each ? [each.registration] : [])),
	};
}

// Test files and kits may build registrations of their own; the server's list must never serve them.
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
