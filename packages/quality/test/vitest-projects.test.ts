import { spawnSync } from "node:child_process";
import { mkdirSync, realpathSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
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

function vitest(root: string, ...args: readonly string[]) {
	const result = spawnSync(process.execPath, [join(vitestRoot, "vitest.mjs"), "run", "--reporter=verbose", "--color=false", ...args], {
		cwd: root,
		encoding: "utf8",
	});
	return { output: `${result.stdout}${result.stderr}`, status: result.status };
}

describe("testProjects", { timeout: 60_000 }, () => {
	it("runs unit tests in Node and *.dom.test files in a DOM, and leaves out slow tests and type tests", () => {
		const run = vitest(repository());
		expect(run.status).toBe(0);
		expect(run.output).toContain("|unit| src/a.test.ts");
		expect(run.output).toContain("|dom| src/b.dom.test.tsx");
		expect(run.output).not.toContain("slow.test");
		expect(run.output).not.toContain("typecheck.test");
	});

	it("runs the slow tests alone when the slow project is asked for", () => {
		const run = vitest(repository(), "--project", "slow");
		expect(run.status).toBe(0);
		expect(run.output).toContain("|slow| src/c.slow.test.ts");
		expect(run.output).not.toContain("src/a.test.ts");
		expect(run.output).not.toContain("typecheck.test");
	});
});
