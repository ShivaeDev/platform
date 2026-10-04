import { type SeedFile, seedTree } from "./tree.ts";

function json(path: string, value: unknown): SeedFile {
	return { content: `${JSON.stringify(value, undefined, "\t")}\n`, path };
}

function code(path: string, ...lines: readonly string[]): SeedFile {
	return { content: `${lines.join("\n")}\n`, path };
}

const COMPILER = { allowImportingTsExtensions: true, module: "esnext", moduleResolution: "bundler", noEmit: true };

const aliasTree: readonly SeedFile[] = [
	{ content: "packages:\n  - 'packages/*'\n", path: "pnpm-workspace.yaml" },
	json("package.json", { name: "@demo/root", private: true, type: "module" }),
	json("tsconfig.json", { compilerOptions: COMPILER }),
	json("packages/app/package.json", { imports: { "#lib/*": "./src/lib/*" }, name: "@demo/app", type: "module" }),
	code(
		"packages/app/src/feature/forms.ts",
		'import type { Format } from "../lib/format.ts";',
		'import "../lib/side.ts";',
		'import { local } from "./local.ts";',
		'import { deeper } from "./parts/deeper.ts";',
		'export { format } from "../lib/format.ts";',
		'export const load = () => import("../lib/format.ts");',
		'export const loaded = require("../lib/side.ts");',
		'vi.mock("../lib/format.ts", () => ({ format: () => "" }));',
		'export const actual = await vi.importActual<Format>("../lib/format.ts");',
		'export const aliased = await import("#lib/format.ts");',
		"export const both = [local, deeper];",
	),
	code("packages/app/src/feature/local.ts", "export const local = 1;"),
	code("packages/app/src/feature/parts/deeper.ts", "export const deeper = 2;"),
	code("packages/app/src/lib/format.ts", "export type Format = string;", "export const format = (value: string): Format => value;"),
	code("packages/app/src/lib/side.ts", "export {};"),
	code("packages/app/src/lib/widgets/index.ts", "export const widget = 1;"),
	code(
		"packages/app/src/lib/uses.ts",
		'import { widget } from "./widgets";',
		'import { ghost } from "../ghost.ts";',
		"export const used = [widget, ghost];",
	),
	code(
		"packages/app/src/feature/documented.ts",
		'/** @import { Format } from "../lib/format.ts" */',
		"",
		"/** @type {Format} */",
		'export const documented = "";',
	),
	code(
		"packages/app/src/feature/described.js",
		'/** @import { Format } from "../lib/format.ts" */',
		"/** @param {Format} value */",
		"export function show(value) {",
		"\treturn value;",
		"}",
	),
	code(
		"packages/app/src/feature/prose.ts",
		"/**",
		' * Prefer @import over a require call, it reads from "../lib/side.ts" lazily.',
		' * @import { Format } from "../lib/format.ts"',
		" */",
		'export const prose: Format = "";',
	),
	code("packages/app/src/kit-user.ts", 'import { button } from "../../kit/src/button.ts";', "export const used = button;"),
	json("packages/kit/package.json", { exports: { "./button": "./src/button.ts" }, name: "@demo/kit", type: "module" }),
	code("packages/kit/src/button.ts", "export const button = 1;"),
	code(
		"packages/app/src/feature/escaped.ts",
		'import { format } from "\\x2e\\x2e/lib/format.ts";',
		'import "..\\/lib/side.ts";',
		"export const escaped = format;",
	),
	code("packages/app/src/vendor-user.ts", 'import pad from "../../../node_modules/left-pad/index.js";', "export const padded = pad;"),
	json("node_modules/left-pad/package.json", { main: "index.js", name: "left-pad", type: "module" }),
	code("node_modules/left-pad/index.js", "export default 1;"),
	code("script/tasks/run.ts", 'import { tool } from "../lib/tool.ts";', "export const run = tool;"),
	code("script/lib/tool.ts", "export const tool = 1;"),
];

export function aliasRepository(): string {
	return seedTree(aliasTree);
}
