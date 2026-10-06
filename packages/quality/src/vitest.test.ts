import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { TestProjectConfiguration } from "vitest/config";
import { packageRoot, removeSeededTrees, type SeedFile, seedTree } from "#test/tree.ts";
import { inheritTags } from "#vitest.ts";

afterEach(removeSeededTrees);

const vitestRoot = dirname(realpathSync(createRequire(import.meta.url).resolve("vitest/package.json")));

const helper = pathToFileURL(join(packageRoot, "src", "vitest.ts")).href;

function testFile(path: string, body: string): SeedFile {
	return { content: `import { expect, it } from "vitest";\n\n${body}\n`, path };
}

function linkVitest(root: string): string {
	mkdirSync(join(root, "node_modules"));
	symlinkSync(vitestRoot, join(root, "node_modules", "vitest"), "dir");
	return root;
}

function repository(options = ""): string {
	return linkVitest(
		seedTree([
			{
				content: `import { defineConfig } from "vitest/config";\nimport { testProjects } from "${helper}";\n\nexport default defineConfig({ test: testProjects(${options}) });\n`,
				path: "vitest.config.ts",
			},
			testFile("src/a.test.ts", 'it("runs in Node", () => {\n\texpect(typeof document).toBe("undefined");\n});'),
			testFile("src/b.dom.test.tsx", 'it("runs in a DOM", () => {\n\texpect(typeof document).toBe("object");\n});'),
			testFile("src/c.slow.test.ts", 'it("runs only when asked for", () => {\n\texpect(typeof document).toBe("undefined");\n});'),
			testFile("src/d.typecheck.test.ts", 'it("never runs", () => {\n\texpect.unreachable();\n});'),
			testFile("src/typecheck.test.ts", 'it("never runs", () => {\n\texpect.unreachable();\n});'),
			testFile("src/flow.spec.ts", 'it("runs in Node", () => {\n\texpect(typeof document).toBe("undefined");\n});'),
			testFile("src/flow.dom.spec.tsx", 'it("runs in a DOM", () => {\n\texpect(typeof document).toBe("object");\n});'),
			testFile("src/flow.typecheck.spec.ts", 'it("never runs", () => {\n\texpect.unreachable();\n});'),
			testFile("e2e/smoke.spec.ts", 'it("belongs to another runner", () => {\n\texpect.unreachable();\n});'),
		]),
	);
}

const BAKERY = "./packages/bakery/vitest.config.ts";

function workspace(projects: string): string {
	return linkVitest(
		seedTree([
			{
				content: `import { defineConfig } from "vitest/config";\nimport { testProjects } from "${helper}";\n\nexport default defineConfig({ test: { ...testProjects(), tags: [{ name: "bakery-story" }] } });\n`,
				path: BAKERY,
			},
			{
				content: `import { defineConfig } from "vitest/config";\nimport { inheritTags } from "${helper}";\nimport bakery from "${BAKERY}";\n\nconst projects = bakery.test.projects.map((project) => ({ ...project, extends: "${BAKERY}", root: "./packages/bakery" }));\n\nexport default defineConfig(async () => ({ test: { project: ["unit"], projects: ${projects} } }));\n`,
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
	it("runs unit tests and specs in Node and .dom tests and specs in a DOM, and leaves out slow tests, type tests and excluded suites", () => {
		expect(vitest(repository('{ exclude: ["e2e/**"] }'))).toMatchObject({
			ran: ["src/a.test.ts passed", "src/b.dom.test.tsx passed", "src/flow.dom.spec.tsx passed", "src/flow.spec.ts passed"],
			status: 0,
		});
	});

	it("runs every spec outside the excluded folders, so a folder of another runner is excluded", () => {
		expect(vitest(repository()).ran).toContain("e2e/smoke.spec.ts failed");
	});

	it("runs the slow tests alone when the slow project is asked for", () => {
		expect(vitest(repository(), "--project", "slow")).toMatchObject({ ran: ["src/c.slow.test.ts passed"], status: 0 });
	});
});

describe("inheritTags", { timeout: 60_000 }, () => {
	it("gives the projects flattened out of an extended package config the tags that package declares", () => {
		expect(vitest(workspace("await inheritTags(projects, import.meta.dirname)"), "--tags-filter=bakery-story")).toMatchObject({
			status: 0,
			tests: ["rises passed", "sets skipped"],
		});
	});

	it("is needed, because Vitest drops the tags of the config an inline project extends", () => {
		expect(vitest(workspace("projects")).failure).toContain('cannot apply "bakery-story" tag for this test');
	});

	it("keeps a project's own tag over an inherited one of the same name, calls a config function, and leaves other projects alone", async () => {
		const root = seedTree([
			{
				content: 'export default () => ({ test: { tags: [{ name: "mill-story", description: "inherited" }, { name: "slow-grind" }] } });\n',
				path: "mill.config.ts",
			},
		]);
		const own = { extends: "./mill.config.ts", test: { name: "mill", tags: [{ description: "own", name: "mill-story" }] } };
		const shared: TestProjectConfiguration = { extends: true, test: { name: "shared" } };
		expect(await inheritTags([own, shared, "packages/*"], root)).toEqual([
			{ ...own, test: { name: "mill", tags: [{ description: "own", name: "mill-story" }, { name: "slow-grind" }] } },
			shared,
			"packages/*",
		]);
	});
});
