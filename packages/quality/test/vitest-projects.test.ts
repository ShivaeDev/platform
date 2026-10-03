import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { packageRoot, removeSeededTrees, type SeedFile, seedTree } from "./support/tree.ts";

afterEach(removeSeededTrees);

const vitestRoot = dirname(realpathSync(createRequire(import.meta.url).resolve("vitest/package.json")));

const helper = pathToFileURL(join(packageRoot, "src", "vitest.ts")).href;

function testFile(path: string, body: string): SeedFile {
	return { content: `import { expect, it } from "vitest";\n\n${body}\n`, path };
}

function repository(): string {
	const root = seedTree([
		{
			content: `import { defineConfig } from "vitest/config";\nimport { testProjects } from "${helper}";\n\nexport default defineConfig({ test: testProjects() });\n`,
			path: "vitest.config.ts",
		},
		testFile("src/a.test.ts", 'it("runs in Node", () => {\n\texpect(typeof document).toBe("undefined");\n});'),
		testFile("src/b.dom.test.tsx", 'it("runs in a DOM", () => {\n\texpect(typeof document).toBe("object");\n});'),
		testFile("src/c.slow.test.ts", 'it("runs only when asked for", () => {\n\texpect(typeof document).toBe("undefined");\n});'),
		testFile("src/d.typecheck.test.ts", 'it("never runs", () => {\n\texpect.unreachable();\n});'),
		testFile("src/typecheck.test.ts", 'it("never runs", () => {\n\texpect.unreachable();\n});'),
	]);
	mkdirSync(join(root, "node_modules"));
	symlinkSync(vitestRoot, join(root, "node_modules", "vitest"), "dir");
	return root;
}

interface Report {
	readonly testResults: readonly { readonly name: string; readonly status: string }[];
}

function vitest(root: string, ...args: readonly string[]) {
	const result = spawnSync(process.execPath, [join(vitestRoot, "vitest.mjs"), "run", "--reporter=json", "--outputFile=report.json", ...args], {
		cwd: root,
		encoding: "utf8",
	});
	const report: Report = JSON.parse(readFileSync(join(root, "report.json"), "utf8"));
	const ran = report.testResults.map((file) => `${file.name.slice(realpathSync(root).length + 1)} ${file.status}`).sort();
	return { ran, status: result.status };
}

describe("testProjects", { timeout: 60_000 }, () => {
	it("runs unit tests in Node and *.dom.test files in a DOM, and leaves out slow tests and type tests", () => {
		expect(vitest(repository())).toEqual({ ran: ["src/a.test.ts passed", "src/b.dom.test.tsx passed"], status: 0 });
	});

	it("runs the slow tests alone when the slow project is asked for", () => {
		expect(vitest(repository(), "--project", "slow")).toEqual({ ran: ["src/c.slow.test.ts passed"], status: 0 });
	});
});
