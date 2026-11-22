import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { rerunStory } from "#test/kit.ts";
import { writeFile } from "#test/suite.ts";

const vitest = JSON.stringify(fileURLToPath(import.meta.resolve("vitest")));
const tsc = join(dirname(createRequire(import.meta.url).resolve("typescript/package.json")), "bin", "tsc");

function recordsRun(...names: readonly string[]): string {
	return `import { appendFileSync } from 'node:fs';
import { it } from ${vitest};

${names.map((name) => `it(${JSON.stringify(name)}, () => {\n\tappendFileSync('ran.txt', ${JSON.stringify(`${name}\n`)});\n});`).join("\n")}
`;
}

export const LOCATED = "located.spec.ts";
const LOCATED_TESTS = ["first", "second"] as const;
export const SECOND_LINE =
	recordsRun(...LOCATED_TESTS)
		.split("\n")
		.findIndex((line) => line.startsWith('it("second"')) + 1;

export function configExcludes(file: string) {
	return rerunStory.trait("configuration", `the Vitest config excludes ${file}`, (suite) => {
		suite.config.exclude = [file];
	});
}

export function filesRecordTheirRun(...files: readonly string[]) {
	return rerunStory.trait("tests", `${files.join(", ")} each hold one test, named after its file, that records it ran`, (suite) => {
		for (const file of files) {
			writeFile(suite, file, recordsRun(file));
		}
	});
}

export function twoTestsInOneFile() {
	return rerunStory.trait("tests", `in ${LOCATED}, "first" and then "second" each record that they ran, "second" on line ${SECOND_LINE}`, (suite) =>
		writeFile(suite, LOCATED, recordsRun(...LOCATED_TESTS)),
	);
}

export function typeTest() {
	return rerunStory.trait(
		"tests",
		'types.test-d.ts holds "types hold", a type test that passes when TypeScript\'s tsc checks it against its own tsconfig.json',
		(suite) => {
			suite.config.typechecker = tsc;
			// tsc's launcher finds node on the PATH, which the executable's process does not inherit.
			suite.config.env = { ...suite.config.env, "PATH": dirname(process.execPath) };
			writeFile(
				suite,
				"tsconfig.json",
				JSON.stringify({
					compilerOptions: { module: "nodenext", moduleResolution: "nodenext", noEmit: true, skipLibCheck: true, strict: true, types: [] },
					include: ["types.test-d.ts"],
				}),
			);
			writeFile(
				suite,
				"types.test-d.ts",
				`import { expectTypeOf, it } from ${vitest};\n\nit('types hold', () => {\n\texpectTypeOf<string>().toEqualTypeOf<string>();\n});\n`,
			);
		},
	);
}
