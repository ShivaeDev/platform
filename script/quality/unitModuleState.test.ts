import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";
import { unitModuleState } from "#quality/unitModuleState.ts";

const UNIT_SPEC = "packages/quality/src/orders.spec.ts";

for (const [shape, files, state] of [
	[
		"a module-level let",
		[
			{ content: 'import { next } from "./counter.ts";\nnext();\n', path: UNIT_SPEC },
			{ content: "let count = 0;\nexport function next() {\n\tcount += 1;\n\treturn count;\n}\n", path: "packages/quality/src/counter.ts" },
		],
		{ file: "packages/quality/src/counter.ts", line: 1, name: "count" },
	],
	[
		"a module-level array the module pushes to",
		[
			{ content: 'import { remember } from "./memory.ts";\nremember("a");\n', path: UNIT_SPEC },
			{
				content: "const seen: string[] = [];\nexport function remember(value: string) {\n\tseen.push(value);\n}\n",
				path: "packages/quality/src/memory.ts",
			},
		],
		{ file: "packages/quality/src/memory.ts", line: 1, name: "seen" },
	],
	[
		"a destructured let in another package's kit reached through a local kit",
		[
			{ content: 'import { kit } from "./test-support/kit.ts";\nkit();\n', path: UNIT_SPEC },
			{ content: 'export { kit } from "../../../story/src/kit.ts";\n', path: "packages/quality/src/test-support/kit.ts" },
			{ content: "export function kit() {}\nlet [first] = [kit];\nfirst = kit;\n", path: "packages/story/src/kit.ts" },
		],
		{ file: "packages/story/src/kit.ts", line: 2, name: "first" },
	],
	[
		"a module-level map the module sets",
		[
			{ content: 'import { remember } from "./registry.ts";\nremember("a");\n', path: UNIT_SPEC },
			{
				content: "const known = new Map<string, number>();\nexport function remember(name: string) {\n\tknown.set(name, known.size);\n}\n",
				path: "packages/quality/src/registry.ts",
			},
		],
		{ file: "packages/quality/src/registry.ts", line: 1, name: "known" },
	],
] as const) {
	ruleKit.it(`a unit spec's shared modules report ${shape}`, [repositoryHas(...files)], function* ({ check }) {
		const findings = yield* check(unitModuleState);

		expect(findings).toEqual([
			{
				file: state.file,
				line: state.line,
				message: `holds module-level state \`${state.name}\` that the files of @shivaedev/quality:unit share, because that project runs without per-file isolation. Keep the state in the story's engine or scope, or key a cache by the run's own objects in a WeakMap.`,
			},
		]);
	});
}

for (const [shape, files] of [
	[
		"a container the module never changes",
		[
			{ content: 'import { has } from "./names.ts";\nhas("a");\n', path: UNIT_SPEC },
			{ content: 'const NAMES = new Set(["a"]);\nexport const has = (name: string) => NAMES.has(name);\n', path: "packages/quality/src/names.ts" },
		],
	],
	[
		"a WeakMap keyed by the run's objects",
		[
			{ content: 'import { measured } from "./cache.ts";\nmeasured({});\n', path: UNIT_SPEC },
			{
				content:
					"const sizes = new WeakMap<object, number>();\nexport function measured(run: object) {\n\tsizes.set(run, 1);\n\treturn sizes.get(run);\n}\n",
				path: "packages/quality/src/cache.ts",
			},
		],
	],
	[
		"state inside a function",
		[
			{ content: 'import { collect } from "./collect.ts";\ncollect();\n', path: UNIT_SPEC },
			{
				content:
					'export function collect() {\n\tconst items: string[] = [];\n\titems.push("a");\n\tlet count = 0;\n\tcount += 1;\n\treturn [items, count];\n}\n',
				path: "packages/quality/src/collect.ts",
			},
		],
	],
	[
		"a module reached only through a type import",
		[
			{ content: 'import type { Shape } from "./shape.ts";\nexport const shape: Shape = 1;\n', path: UNIT_SPEC },
			{ content: "export let current = 0;\nexport type Shape = number;\n", path: "packages/quality/src/shape.ts" },
		],
	],
	[
		"a module only a heavy spec loads",
		[
			{ content: 'import { next } from "./counter.ts";\nnext();\n', path: "packages/quality/src/orders.heavy.spec.ts" },
			{ content: "let count = 0;\nexport function next() {\n\tcount += 1;\n\treturn count;\n}\n", path: "packages/quality/src/counter.ts" },
		],
	],
	["a spec's own module-level state", [{ content: "let story = 0;\nstory += 1;\n", path: UNIT_SPEC }]],
	[
		"a module only another package's spec loads",
		[
			{ content: 'import { next } from "./counter.ts";\nnext();\n', path: "packages/orders/src/orders.spec.ts" },
			{ content: "let count = 0;\nexport function next() {\n\tcount += 1;\n\treturn count;\n}\n", path: "packages/orders/src/counter.ts" },
		],
	],
] as const) {
	ruleKit.it(`a unit spec's shared modules accept ${shape}`, [repositoryHas(...files)], function* ({ check }) {
		expect(yield* check(unitModuleState)).toEqual([]);
	});
}
