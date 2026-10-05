import ts from "typescript";
import { isTestSupport, testName } from "#naming/testName.ts";
import { defineRule, type Finding, type SourceFile } from "#rule.ts";
import { parse } from "#rules/syntax.ts";
import { fixtureWrites } from "./fixtureWrites.ts";

const SETUP_HELPER = /^(?:seed|make|build|setup)(?![a-z])/u;
const STORY_KIT =
	"Name the setup in domain words as traits of the repository's story kit in test-support/, so the test reads as a story: see https://github.com/ShivaeDev/platform/tree/main/packages/quality#story-tests.";

function isTestFile(path: string): boolean {
	return testName(path) !== undefined && !isTestSupport(path);
}

function lineOf(source: ts.SourceFile, node: ts.Node): number {
	return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function unwrapped(node: ts.Expression): ts.Expression {
	return ts.isParenthesizedExpression(node) ? unwrapped(node.expression) : node;
}

function isFunction(node: ts.Expression | undefined): boolean {
	return node !== undefined && (ts.isArrowFunction(unwrapped(node)) || ts.isFunctionExpression(unwrapped(node)));
}

function helpersOf(statement: ts.Statement): readonly ts.Identifier[] {
	if (ts.isFunctionDeclaration(statement)) {
		return statement.name === undefined || statement.body === undefined ? [] : [statement.name];
	}
	if (!ts.isVariableStatement(statement)) {
		return [];
	}
	return statement.declarationList.declarations.flatMap((declaration) =>
		ts.isIdentifier(declaration.name) && isFunction(declaration.initializer) ? [declaration.name] : [],
	);
}

function storySetupIn(file: SourceFile): readonly Finding[] {
	const source = isTestFile(file.path) ? parse(file) : undefined;
	if (source === undefined) {
		return [];
	}
	const helpers = source.statements
		.flatMap(helpersOf)
		.filter((name) => SETUP_HELPER.test(name.text))
		.map((name) => ({
			file: file.path,
			line: lineOf(source, name),
			message: `Declares the setup helper "${name.text}". ${STORY_KIT}`,
			subject: name.text,
		}));
	const writes = fixtureWrites(source).map(({ call, name }) => ({
		file: file.path,
		line: lineOf(source, call),
		message: `Writes a fixture with ${name}. ${STORY_KIT}`,
		subject: name,
	}));
	return [...helpers, ...writes];
}

export const storySetup = defineRule({
	check: ({ sources }) => sources.flatMap(storySetupIn),
	description:
		"A test reads as a story over the domain words of the repository's story kit in test-support/. It names its setup as traits instead of declaring seed, make, build or setup helpers or writing fixture files.",
	id: "tests/story-setup",
});
