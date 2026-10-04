import { describe, expect, it } from "vitest";
import { noJsdoc } from "#rules/comments/no-jsdoc.ts";
import { noTodo } from "#rules/comments/no-todo.ts";
import { checkRule } from "#test/support/inputs.ts";

const todos = async (path: string, ...content: readonly string[]) =>
	(await checkRule(noTodo, undefined, { sources: [{ content: content.join("\n"), path }] })).map((finding) => finding.line);

describe("comment rules read comments, not code", () => {
	it("ignore comment markers inside strings", async () => {
		expect(await todos("src/a.ts", 'const a = "// TODO";', "const b = '/* TODO */';")).toEqual([]);
	});

	it("ignore template literal text but read comments inside its expressions", async () => {
		expect(await todos("src/a.ts", "const t = `// TODO ${", "\tx /* TODO */", "} /* TODO */`;")).toEqual([2]);
	});

	it("ignore comment markers inside regular expressions", async () => {
		expect(await todos("src/a.ts", "const r = /\\/\\/ TODO/;", "const s = /[/*]TODO/;")).toEqual([]);
	});

	it("ignore JSX text but read comments in JSX expressions", async () => {
		expect(await todos("src/a.tsx", "export const A = () => (", "\t<p>", "\t\t// TODO", "\t\t{/* TODO */}", "\t</p>", ");")).toEqual([4]);
	});

	it("report each comment at the line it starts on", async () => {
		expect(await todos("src/a.ts", "const a = 1; // TODO", "/*", " * TODO", " */", "// TODO")).toEqual([1, 2, 5]);
	});

	it("read JavaScript modules and JSX", async () => {
		const paths = ["src/a.js", "src/b.mjs", "src/c.cjs", "src/d.jsx", "src/e.mts", "src/f.cts"];
		const findings = await checkRule(noTodo, undefined, { sources: paths.map((path) => ({ content: "// TODO\n", path })) });
		expect(findings.map((finding) => finding.file)).toEqual(paths);
	});

	it("skip declaration files and files that are not scripts", async () => {
		const paths = ["src/a.d.ts", "src/b.d.mts", "src/c.d.cts", "src/d.css", "README.md"];
		const sources = paths.map((path) => ({ content: "/** TODO */\n// TODO\n", path }));
		expect(await checkRule(noTodo, undefined, { sources })).toEqual([]);
		expect(await checkRule(noJsdoc, undefined, { sources })).toEqual([]);
	});
});
