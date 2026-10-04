import { posix } from "node:path";
import { Effect, Schema } from "effect";
import ignore from "ignore";
import { ENVIRONMENTS, type TestName, testName } from "#naming/testName.ts";
import { CAMEL } from "#naming/words.ts";
import { defineRule, type Finding, type SourceFile } from "#rule.ts";
import { usesDom } from "#rules/test-names/usesDom.ts";

const ENVIRONMENT_NAMES: ReadonlySet<string> = new Set(ENVIRONMENTS);

const FIXTURE_SUFFIXES: ReadonlySet<string> = new Set(["integration", "postgres"]);

const CODE = /\.[cm]?[jt]sx?$/u;

const GRAMMAR =
	"A test file is <file>[.<environment>].test.ts beside its file or <behaviour>[.<environment>].spec.ts in the folder it covers, with at most one environment of dom, slow and typecheck.";

const TestsFollowOptions = Schema.Struct({
	suites: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
});

function siblingsIn(files: readonly string[]): ReadonlySet<string> {
	return new Set(files.filter((file) => CODE.test(file) && testName(file) === undefined).map((file) => file.replace(CODE, "")));
}

function suffixMessage(file: string, name: TestName): string | undefined {
	const [first, ...rest] = name.modifiers;
	if (first === undefined || (rest.length === 0 && ENVIRONMENT_NAMES.has(first))) {
		return undefined;
	}
	const fixture = name.modifiers.find((modifier) => FIXTURE_SUFFIXES.has(modifier));
	if (fixture !== undefined) {
		return `".${fixture}" is not a test environment. A test that needs a database or a running app takes it from the app's test fixture and is named like any other test. ${GRAMMAR}`;
	}
	return `"${file}" has the suffixes ".${name.modifiers.join(".")}". ${GRAMMAR} An aspect of a module gets its own file in the module's folder, or a .spec.`;
}

function placeMessage(file: string, name: TestName, siblings: ReadonlySet<string>): string | undefined {
	const covered = siblings.has(`${name.folder}/${name.stem}`);
	if (name.kind === "test") {
		return covered
			? undefined
			: `"${file}" follows no file: ${name.stem}.test${name.extension} sits beside ${name.stem}.ts in the same folder. A test that covers the folder as a whole is a <behaviour>.spec${name.extension}, such as checkoutFlow.spec${name.extension}.`;
	}
	if (covered) {
		return `"${file}" shares its name with ${name.stem}.ts. A .spec names a behaviour of its folder, such as checkoutFlow.spec${name.extension}; a test of ${name.stem}.ts is ${name.stem}.test${name.extension}.`;
	}
	return CAMEL.test(name.stem) ? undefined : `"${file}" names its behaviour in camelCase, such as checkoutFlow.spec${name.extension}.`;
}

function environmentMessage(file: string, name: TestName, source: SourceFile): string | undefined {
	if (name.modifiers.includes("dom") || name.modifiers.includes("typecheck") || !usesDom(source)) {
		return undefined;
	}
	return `"${file}" uses the DOM, so it is ${name.stem}.dom.${name.kind}${name.extension} and runs in the dom project.`;
}

function findingsOf(source: SourceFile, siblings: ReadonlySet<string>): readonly Finding[] {
	const name = testName(source.path);
	if (name === undefined) {
		return [];
	}
	const file = posix.basename(source.path);
	const messages = [suffixMessage(file, name), placeMessage(file, name, siblings), environmentMessage(file, name, source)];
	return messages.flatMap((message) => (message === undefined ? [] : [{ file: source.path, message }]));
}

export const testsFollow = defineRule({
	check: ({ files, options, sources }) => {
		const suites = ignore().add([...options.suites]);
		const siblings = siblingsIn(files);
		return sources.filter((source) => !suites.ignores(source.path)).flatMap((source) => findingsOf(source, siblings));
	},
	description:
		"A .test file follows the file beside it, a .spec names a behaviour of its folder, the only suffix is one environment of dom, slow and typecheck, and a test that uses the DOM is a .dom test.",
	id: "tests/follow",
	options: Schema.toStandardSchemaV1(TestsFollowOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
});
