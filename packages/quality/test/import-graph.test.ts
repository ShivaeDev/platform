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

	it("ignores a loop that only `import type`, `export type` and type queries close", async () => {
		expect(await findingsIn(importCycles, undefined, importTree("typeCycle"))).toEqual([]);
	});
});

describe("imports/resolvable", () => {
	it("reports an import of a missing file or an uninstalled package, and resolves builtins, assets, declared and generated modules", async () => {
		const findings = await findingsIn(importsResolvable, undefined, importTree("unresolvable"));
		expect(findings.map((finding) => [finding.line, finding.subject])).toEqual([
			[1, "./gone.ts"],
			[2, "left-pad"],
		]);
		expect(findings[0]?.message).toBe(
			'Cannot resolve "./gone.ts". Fix the path, install or declare the package, or declare the module in a .d.ts file among the sources.',
		);
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
