import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { packageRoot, removeSeededTrees, type SeedFile, seedTree } from "#test/tree.ts";

afterEach(removeSeededTrees);

const vitestRoot = dirname(realpathSync(createRequire(import.meta.url).resolve("vitest/package.json")));

const helper = pathToFileURL(join(packageRoot, "src", "testProjects.ts")).href;

function testFile(path: string, body: string): SeedFile {
	return { content: `import { expect, it } from "vitest";\n\n${body}\n`, path };
}

function linkVitest(root: string): string {
	mkdirSync(join(root, "node_modules"));
	symlinkSync(vitestRoot, join(root, "node_modules", "vitest"), "dir");
	return root;
}

function config(options = ""): SeedFile {
	return {
		content: `import { defineConfig } from "vitest/config";\nimport { testProjects } from "${helper}";\n\nexport default defineConfig({ test: testProjects(${options}) });\n`,
		path: "vitest.config.ts",
	};
}

function repository(options = ""): string {
	return linkVitest(
		seedTree([
			config(options),
			testFile("src/a.test.ts", 'it("runs in Node", () => {\n\texpect(typeof document).toBe("undefined");\n});'),
			testFile("src/b.dom.test.tsx", 'it("runs in a DOM", () => {\n\texpect(typeof document).toBe("object");\n});'),
			testFile("src/c.slow.test.ts", 'it("runs only when asked for", () => {\n\texpect(typeof document).toBe("undefined");\n});'),
			testFile("src/d.typecheck.test.ts", 'it("never runs", () => {\n\texpect.unreachable();\n});'),
			testFile("src/typecheck.test.ts", 'it("never runs", () => {\n\texpect.unreachable();\n});'),
			testFile("src/flow.spec.ts", 'it("runs in Node", () => {\n\texpect(typeof document).toBe("undefined");\n});'),
			testFile("src/flow.dom.spec.tsx", 'it("runs in a DOM", () => {\n\texpect(typeof document).toBe("object");\n});'),
			testFile("src/flow.typecheck.spec.ts", 'it("never runs", () => {\n\texpect.unreachable();\n});'),
			testFile("e2e/smoke.spec.ts", 'it("runs every suite", () => {\n\texpect(typeof document).toBe("undefined");\n});'),
		]),
	);
}

const BAKERY = "./packages/bakery/vitest.config.ts";

function workspace(): string {
	return linkVitest(
		seedTree([
			{
				content: `import { defineConfig } from "vitest/config";\nimport { testProjects } from "${helper}";\n\nexport default defineConfig({ test: { ...testProjects(), tags: [{ name: "bakery-story" }] } });\n`,
				path: BAKERY,
			},
			{
				content: `import { defineConfig } from "vitest/config";\nimport bakery from "${BAKERY}";\n\nconst projects = bakery.test.projects.map((project) => ({ ...project, extends: "${BAKERY}", root: "./packages/bakery" }));\n\nexport default defineConfig(async () => ({ test: { project: ["unit"], projects } }));\n`,
				path: "vitest.config.ts",
			},
			testFile("packages/bakery/src/bread.test.ts", 'it("rises", { tags: ["bakery-story"] }, () => {\n\texpect(1).toBe(1);\n});'),
			testFile("packages/bakery/src/cake.test.ts", 'it("sets", () => {\n\texpect(1).toBe(1);\n});'),
		]),
	);
}

interface Report {
	readonly testResults: readonly {
		readonly assertionResults: readonly { readonly status: string; readonly title: string }[];
		readonly message: string;
		readonly name: string;
		readonly status: string;
	}[];
}

function vitest(root: string, ...args: readonly string[]) {
	const result = spawnSync(process.execPath, [join(vitestRoot, "vitest.mjs"), "run", "--reporter=json", "--outputFile=report.json", ...args], {
		cwd: root,
		encoding: "utf8",
	});
	const report: Report = JSON.parse(readFileSync(join(root, "report.json"), "utf8"));
	const ran = report.testResults.map((file) => `${file.name.slice(realpathSync(root).length + 1)} ${file.status}`).sort();
	const tests = report.testResults.flatMap((file) => file.assertionResults.map((test) => `${test.title} ${test.status}`)).sort();
	const failure = report.testResults.map((file) => file.message).join("");
	return { failure, ran, status: result.status, tests };
}

describe("testProjects", { timeout: 60_000 }, () => {
	it("runs unit tests and specs in Node, in any folder, and .dom tests and specs in a DOM, and leaves out slow and type tests", () => {
		expect(vitest(repository())).toMatchObject({
			ran: [
				"e2e/smoke.spec.ts passed",
				"src/a.test.ts passed",
				"src/b.dom.test.tsx passed",
				"src/flow.dom.spec.tsx passed",
				"src/flow.spec.ts passed",
			],
			status: 0,
		});
	});

	it("runs the slow tests alone when the slow project is asked for", () => {
		expect(vitest(repository(), "--project", "slow")).toMatchObject({ ran: ["src/c.slow.test.ts passed"], status: 0 });
	});

	it("runs the tagged tests of a package config that a root config's inline projects extend", () => {
		expect(vitest(workspace(), "--tags-filter=bakery-story")).toMatchObject({ status: 0, tests: ["rises passed", "sets skipped"] });
	});
});
