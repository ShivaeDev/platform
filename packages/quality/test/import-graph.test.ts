import { afterEach, describe, expect, it } from "vitest";
import { importGraph } from "../src/imports/graph.ts";
import { importCycles } from "../src/rules/imports/cycles.ts";
import { importsResolvable } from "../src/rules/imports/resolvable.ts";
import { findingsIn, importTree, linkWorkspace, scanned } from "./support/imports.ts";
import { removeSeededTrees } from "./support/tree.ts";

afterEach(removeSeededTrees);

describe("imports/cycles", () => {
	it("reports each group of modules that import each other at runtime once, counting its modules", async () => {
		const findings = await findingsIn(importCycles, undefined, importTree("cycle"));
		expect(findings).toEqual([
			{
				count: 3,
				file: "src/a.ts",
				line: 1,
				message:
					"3 modules import each other at runtime: src/a.ts, src/b.ts, src/c.ts. One loop: src/a.ts -> src/b.ts -> src/c.ts -> src/a.ts. Move what they share into a module that imports neither, or import only types with `import type`.",
			},
			expect.objectContaining({ count: 1, file: "src/lazy.ts", line: 1 }),
		]);
	});

	it("names a module that imports itself as such", async () => {
		const [, self] = await findingsIn(importCycles, undefined, importTree("cycle"));
		expect(self?.message).toBe("src/lazy.ts imports itself at runtime. Use its own code directly instead of importing it.");
	});

	it("ignores a loop that only `import type`, `export type` and type queries close", async () => {
		expect(await findingsIn(importCycles, undefined, importTree("typeCycle"))).toEqual([]);
	});
});

describe("imports/resolvable", () => {
	it("resolves builtins, assets, declared modules and type imports of declarations, and reports every other import", async () => {
		const findings = await findingsIn(importsResolvable, undefined, importTree("unresolvable"));
		expect(findings.map((finding) => [finding.line, finding.subject])).toEqual([
			[1, "./gone.ts"],
			[2, "left-pad"],
			[6, "./generated/client.ts"],
			[9, "../dist/does-not-exist.ts"],
			[10, "./node_modules/ghost/index.ts"],
			[11, "./missing.css"],
			[12, "other:thing"],
			[13, "augmented"],
			[14, "./ghost.ts"],
			[16, "hast"],
		]);
		expect(findings[0]?.message).toBe(
			'Cannot resolve "./gone.ts". Fix the path, install or declare the package, or declare the module in a .d.ts file among the sources.',
		);
	});

	it("takes a missing file under a declared generated folder as resolved", async () => {
		const findings = await findingsIn(importsResolvable, { generated: ["src/generated"] }, importTree("unresolvable"));
		expect(findings.map((finding) => finding.subject)).not.toContain("./generated/client.ts");
		expect(findings).toHaveLength(9);
	});

	it("refuses a generated folder under node_modules or one that no import names", async () => {
		await expect(findingsIn(importsResolvable, { generated: ["src/node_modules/ghost", "src/unused"] }, importTree("unresolvable"))).rejects.toThrow(
			[
				"the generated folders are invalid:",
				'  - "src/node_modules/ghost" lies in node_modules, which holds installed packages, not generated output',
				'  - "src/unused" holds no file that an import names',
			].join("\n"),
		);
	});

	it("checks type references, JSDoc @import tags and require.resolve too", async () => {
		const findings = await findingsIn(importsResolvable, undefined, importTree("references"));
		expect(findings.map((finding) => [finding.file, finding.line, finding.subject])).toEqual([
			["src/env.d.ts", 2, "absent"],
			["src/tool.js", 2, "./gone-type.ts"],
			["src/where.ts", 2, "./nowhere.cjs"],
		]);
	});
});

describe("the import graph", () => {
	it("resolves tsconfig paths, package.json imports, a workspace package's source export, JSON and require", async () => {
		const root = importTree("resolution");
		linkWorkspace(root, "@demo/shared", "packages/shared");
		const graph = await importGraph(await scanned(root));
		expect(graph.unresolved).toEqual([]);
		expect(graph.edges.filter((edge) => edge.from === "src/main.ts").map((edge) => edge.to)).toEqual([
			{ kind: "file", path: "src/aliased.ts" },
			{ kind: "file", path: "src/lib/imported.ts" },
			{ kind: "file", path: "packages/shared/src/index.ts" },
			{ kind: "file", path: "src/config.json" },
			{ kind: "file", path: "src/required.cjs" },
		]);
	});

	it("fails closed when the sources hold no module", async () => {
		await expect(findingsIn(importCycles, undefined, importTree("empty"))).rejects.toThrow(
			"the import graph covers no modules: the sources hold no TypeScript or JavaScript module.",
		);
	});
});
