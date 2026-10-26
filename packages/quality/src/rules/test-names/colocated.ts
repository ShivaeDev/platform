import { posix } from "node:path";
import { Effect, Schema } from "effect";
import ignore from "ignore";
import { isTestCode, testName } from "#naming/testName.ts";
import { defineRule, type Finding } from "#rule.ts";

const MIRROR_FOLDERS: ReadonlySet<string> = new Set(["__tests__", "spec", "test", "tests"]);

const TestsColocatedOptions = Schema.Struct({
	suites: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
});

function findingOf(path: string, sourceFolders: ReadonlySet<string>): readonly Finding[] {
	const name = testName(path);
	const mirror = name?.folder
		.split("/")
		.find(
			(folder, index, folders) => MIRROR_FOLDERS.has(folder) && (folder === "__tests__" || !sourceFolders.has(folders.slice(0, index + 1).join("/"))),
		);
	if (name === undefined || mirror === undefined) {
		return [];
	}
	const modifiers = name.modifiers.map((modifier) => `.${modifier}`).join("");
	return [
		{
			file: path,
			message: `Sits in the test folder "${mirror}/". A test, tests or spec folder is test-only when its directly contained checked files are all tests or test support; __tests__ is always a test folder. A test sits beside the file it covers, as ${name.stem}${modifiers}.test${name.extension} beside ${name.stem}.ts, or as a <behaviour>${modifiers}.spec${name.extension} at the module root or directly beside the module folder. Shared test support belongs in test-support/. A folder of tests that cover several packages is a suite in the "suites" option.`,
		},
	];
}

export const testsColocated = defineRule({
	check: ({ files, options }) => {
		const suites = ignore().add([...options.suites]);
		const sourceFolders = new Set(files.filter((path) => !isTestCode(path)).map((path) => posix.dirname(path)));
		return files.filter((path) => !suites.ignores(path)).flatMap((path) => findingOf(path, sourceFolders));
	},
	description:
		"A test sits beside the code it covers, at its module root or directly beside its module folder. Outside declared suites, __tests__ is always a test folder; test, tests and spec are test folders only when their directly contained checked files are all tests or test support. Shared test support belongs in test-support/.",
	id: "tests/colocated",
	options: Schema.toStandardSchemaV1(TestsColocatedOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
});
