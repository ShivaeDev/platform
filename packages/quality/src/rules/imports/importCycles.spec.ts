import { expect } from "vitest";
import { importCycles } from "#rules/imports/cycles.ts";
import { fixtureTree } from "#test/fixtureTree.ts";
import { importStory, repositoryHolds } from "#test/importStory.ts";

const LOOPS = repositoryHolds(fixtureTree("cycle"));

importStory.it(
	"imports/cycles reports each group of modules that import each other at runtime once, at its first module",
	[LOOPS],
	function* ({ check, locations }) {
		yield* check(importCycles);

		expect(yield* locations()).toEqual(["src/a.ts:1", "src/lazy.ts:1"]);
	},
);

importStory.it("imports/cycles counts the modules of a group and names them and one loop through them", [LOOPS], function* ({ check }) {
	const findings = yield* check(importCycles);

	expect(findings).toContainEqual({
		count: 3,
		file: "src/a.ts",
		line: 1,
		message:
			"3 modules import each other at runtime: src/a.ts, src/b.ts, src/c.ts. One loop: src/a.ts -> src/b.ts -> src/c.ts -> src/a.ts. Move what they share into a module that imports neither, or import only types with `import type`.",
	});
});

importStory.it("imports/cycles names a module that imports itself as such", [LOOPS], function* ({ check }) {
	const findings = yield* check(importCycles);

	expect(findings).toContainEqual({
		count: 1,
		file: "src/lazy.ts",
		line: 1,
		message: "src/lazy.ts imports itself at runtime. Use its own code directly instead of importing it.",
	});
});

importStory.it(
	"imports/cycles ignores a loop that only `import type`, `export type` and type queries close",
	[repositoryHolds(fixtureTree("typeCycle"))],
	function* ({ check }) {
		expect(yield* check(importCycles)).toEqual([]);
	},
);

importStory.it(
	"the import graph refuses sources that hold no module, so a misdirected config cannot pass",
	[repositoryHolds(fixtureTree("empty"))],
	function* ({ refusal }) {
		expect(yield* refusal(importCycles)).toBe(
			"the import graph covers no modules: the sources hold no TypeScript or JavaScript module. Point `sources` at the TypeScript or JavaScript code.",
		);
	},
);
