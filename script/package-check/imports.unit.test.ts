import { expect, it } from "vitest";
import { missingImportTargets } from "#package-check/imports.ts";

const imports = { "#test-support/*.ts": "./src/test-support/*.ts" };
const NOT_PACKED = "imports #test-support/host.ts, whose target ./src/test-support/host.ts is not packed";

function problems(path: string, source: string): string[] {
	return missingImportTargets(imports, new Set(), new Map([[path, source]]));
}

it("ignores import-like text in a template literal after a regex holding a quote", () => {
	const source = ["const pattern = /[\"']/u, kit = `", 'import { startHost } from "#test-support/host.ts";', "`;"].join("\n");
	expect(problems("dist/cli.js", source)).toEqual([]);
});

for (const [form, path, source] of [
	["a static import", "dist/cli.js", 'import { startHost } from "#test-support/host.ts";'],
	["a bare import", "dist/cli.js", 'import "#test-support/host.ts";'],
	["a type import", "dist/cli.d.ts", 'import type { Host } from "#test-support/host.ts";'],
	["a re-export", "dist/cli.js", 'export { startHost } from "#test-support/host.ts";'],
	["a star re-export", "dist/cli.js", 'export * from "#test-support/host.ts";'],
	["a dynamic import", "dist/cli.js", 'const host = await import("#test-support/host.ts");'],
	["a dynamic import of a plain template", "dist/cli.js", "const host = await import(`#test-support/host.ts`);"],
	["an import type", "dist/cli.d.ts", 'export type Host = import("#test-support/host.ts").Host;'],
	["an import-equals", "dist/cli.d.ts", 'import host = require("#test-support/host.ts");'],
	["a module augmentation", "dist/cli.d.ts", 'export {};\ndeclare module "#test-support/host.ts" {}'],
] as const) {
	it(`reports ${form} of an unpacked target`, () => {
		expect(problems(path, source)).toEqual([`${path} ${NOT_PACKED}`]);
	});
}

it("reports a real import after a regex holding a quote", () => {
	const source = 'const pattern = /["\']/u;\nimport { startHost } from "#test-support/host.ts";';
	expect(problems("dist/cli.js", source)).toEqual([`dist/cli.js ${NOT_PACKED}`]);
});

it("leaves a package import and a computed dynamic import alone", () => {
	expect(problems("dist/cli.js", 'import "effect";\nconst name = "#test-support/host.ts";\nawait import(name);')).toEqual([]);
});
