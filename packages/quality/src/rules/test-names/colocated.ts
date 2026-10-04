import { Effect, Schema } from "effect";
import ignore from "ignore";
import { testName } from "#naming/testName.ts";
import { defineRule, type Finding } from "#rule.ts";

const MIRROR_FOLDERS: ReadonlySet<string> = new Set(["__tests__", "spec", "test", "tests"]);

const TestsColocatedOptions = Schema.Struct({
	suites: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
});

function findingOf(path: string): readonly Finding[] {
	const name = testName(path);
	const mirror = name?.folder.split("/").find((folder) => MIRROR_FOLDERS.has(folder));
	if (name === undefined || mirror === undefined) {
		return [];
	}
	return [
		{
			file: path,
			message: `Sits in the test folder "${mirror}/". A test sits beside the file it covers, as ${name.stem}.test${name.extension} beside ${name.stem}.ts, or as a <behaviour>.spec${name.extension} in the folder it covers. A folder of tests that cover several packages is a suite in the "suites" option.`,
		},
	];
}

export const testsColocated = defineRule({
	check: ({ files, options }) => {
		const suites = ignore().add([...options.suites]);
		return files.filter((path) => !suites.ignores(path)).flatMap(findingOf);
	},
	description: "A test sits beside the code it covers, not in a test, tests, __tests__ or spec folder, unless that folder is a declared suite.",
	id: "tests/colocated",
	options: Schema.toStandardSchemaV1(TestsColocatedOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
});
