interface SeedFile {
	readonly content: string;
	readonly path: string;
}

const helper = new URL("../../../packages/quality/src/adapters/testProjects.ts", import.meta.url).href;

export function projectConfig(options = "", extra = ""): SeedFile {
	return {
		content: `import { defineConfig } from "vitest/config";
import { testProjects } from "${helper}";
export default defineConfig({ test: { ...testProjects(${options}), ${extra} } });
`,
		path: "vitest.config.ts",
	};
}

function spec(path: string, body: string): SeedFile {
	return { content: `import { expect, it } from "vitest";\n${body}\n`, path };
}

export const projectFiles: readonly SeedFile[] = [
	{ content: '{ "type": "module" }\n', path: "package.json" },
	projectConfig(),
	{ content: "export const double = (value: number) => value * 2;\n", path: "src/double.ts" },
	{ content: 'export const label = (value: number) => "Double: " + value * 2;\n', path: "src/label.ts" },
	{ content: "export const unvisited = () => 42;\n", path: "src/unvisited.ts" },
	{ content: "export const fixture = () => 42;\n", path: "src/test-support/fixture.ts" },
	spec(
		"src/unit.test.ts",
		'import { double } from "./double.ts";\nit("doubles in Node", () => { expect(double(3)).toBe(6); expect(typeof document).toBe("undefined"); });',
	),
	spec("src/double.unit.spec.ts", 'import { double } from "./double.ts";\nit("doubles in a unit spec", () => { expect(double(3)).toBe(6); });'),
	spec(
		"src/double.unit.test.ts",
		'import { double } from "./double.ts";\nimport process from "node:process";\nit("doubles as a unit", () => { expect(double(2)).toBe(4); });',
	),
	spec(
		"src/host.dom.spec.tsx",
		`import { label } from "./label.ts";
it("keeps the Node host separate from the document", () => {
	const output = document.createElement("output");
	output.textContent = label(4);
	document.body.append(output);
	expect(document.body.textContent).toBe("Double: 8");
	expect(globalThis.Request).not.toBe(window.Request);
	expect(globalThis.AbortController).not.toBe(window.AbortController);
});`,
	),
	spec("src/document.dom.test.tsx", 'it("has a document", () => { expect(document.createElement("p").tagName).toBe("P"); });'),
	spec(
		"src/flow.spec.ts",
		'import { readFileSync } from "node:fs";\nit("reads files in ordinary Node specs", () => { expect(readFileSync("package.json", "utf8")).toContain("module"); });',
	),
	spec("e2e/smoke.spec.ts", 'it("runs specs outside src", () => { expect(typeof document).toBe("undefined"); });'),
	spec("src/long.slow.test.ts", 'it("runs slow tests on request", () => { expect(typeof document).toBe("undefined"); });'),
	...["src/never.typecheck.test.ts", "src/typecheck.test.ts", "src/never.typecheck.spec.ts"].map((path) =>
		spec(path, 'it("never runs type tests", () => { expect.unreachable(); });'),
	),
];
