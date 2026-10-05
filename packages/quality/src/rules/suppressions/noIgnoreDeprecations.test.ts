import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RuleInputs } from "#rule.ts";
import { noIgnoreDeprecations } from "#rules/suppressions/noIgnoreDeprecations.ts";
import { removeSeededTrees, type SeedFile, seedTree } from "#test/support/tree.ts";

afterEach(removeSeededTrees);

const MESSAGE =
	'Sets "ignoreDeprecations", which silences TypeScript\'s errors for deprecated options. Remove it and replace the deprecated option it hides.';

const IGNORING = '{\n\t"compilerOptions": {\n\t\t"strict": true,\n\t\t"ignoreDeprecations": "6.0"\n\t}\n}\n';

function at(file: string, line: number) {
	return { file, line, message: MESSAGE, subject: "ignoreDeprecations" };
}

async function findingsIn(...files: readonly SeedFile[]) {
	const root = seedTree(files);
	const configured = await noIgnoreDeprecations.configure(undefined);
	if (configured._tag === "Invalid") {
		throw new Error(configured.issues.join("; "));
	}
	const inputs: RuleInputs = {
		files: [],
		readText: (path) => readFile(join(root, path), "utf8").catch(() => undefined),
		root,
		sources: [],
	};
	return configured.check(inputs);
}

describe("suppressions/no-ignore-deprecations", () => {
	it("reports ignoreDeprecations in every tsconfig the repository owns, whatever its name or folder", async () => {
		const findings = await findingsIn(
			{ content: "ignored/\n", path: ".gitignore" },
			{ content: IGNORING, path: "tsconfig.json" },
			{ content: IGNORING, path: "packages/web/tsconfig.build.json" },
			{ content: `// shared\n${IGNORING.replace('"6.0"\n', '"6.0",\n')}`, path: "tsconfig/browser.json" },
			{ content: IGNORING, path: "ignored/tsconfig.json" },
			{ content: IGNORING, path: "node_modules/some-package/tsconfig.json" },
		);
		expect(findings).toEqual([at("packages/web/tsconfig.build.json", 4), at("tsconfig.json", 4), at("tsconfig/browser.json", 5)]);
	});

	it("passes a tsconfig that names ignoreDeprecations anywhere but its compilerOptions", async () => {
		const findings = await findingsIn(
			{ content: '{ "compilerOptions": { "strict": true }, "ignoreDeprecations": "6.0" }\n', path: "tsconfig.json" },
			{ content: '{ "description": "never set ignoreDeprecations" }\n', path: "notes.json" },
		);
		expect(findings).toEqual([]);
	});
});
