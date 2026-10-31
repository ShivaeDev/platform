import { expect } from "vitest";
import { noTodo } from "#rules/comments/noTodo.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const scanned = [
	["ignores comment markers inside strings", "src/a.ts", ['const a = "// TODO";', "const b = '/* TODO */';"], []],
	["ignores comment markers inside regular expressions", "src/a.ts", ["const r = /\\/\\/ TODO/;", "const s = /[/*]TODO/;"], []],
	[
		"ignores template literal text but reads a comment inside its expression",
		"src/a.ts",
		["const t = `// TODO ${", "\tx /* TODO */", "} /* TODO */`;"],
		["src/a.ts:2"],
	],
	[
		"ignores JSX text but reads a comment in a JSX expression",
		"src/a.tsx",
		["export const A = () => (", "\t<p>", "\t\t// TODO", "\t\t{/* TODO */}", "\t</p>", ");"],
		["src/a.tsx:4"],
	],
	[
		"reports each comment at the line it starts on",
		"src/a.ts",
		["const a = 1; // TODO", "/*", " * TODO", " */", "// TODO"],
		["src/a.ts:1", "src/a.ts:2", "src/a.ts:5"],
	],
] as const;

for (const [claim, path, lines, expected] of scanned) {
	ruleStory.it(`comments/no-todo ${claim}`, [repositoryHas({ content: lines.join("\n"), path })], function* ({ check, locations }) {
		yield* check(noTodo);

		expect(yield* locations()).toEqual(expected);
	});
}

for (const extension of ["js", "mjs", "cjs", "jsx", "mts", "cts"]) {
	ruleStory.it(
		`comments/no-todo reads the comments of a .${extension} module`,
		[repositoryHas({ content: "// TODO\n", path: `src/a.${extension}` })],
		function* ({ check, locations }) {
			yield* check(noTodo);

			expect(yield* locations()).toEqual([`src/a.${extension}:1`]);
		},
	);
}

for (const extension of ["ts", "mts", "cts"]) {
	ruleStory.it(
		`comments/no-todo skips the comments of a .d.${extension} declaration file`,
		[repositoryHas({ content: "/** TODO */\n// TODO\n", path: `src/a.d.${extension}` })],
		function* ({ check }) {
			expect(yield* check(noTodo)).toEqual([]);
		},
	);
}
