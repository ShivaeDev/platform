import { linkWorkspace } from "./imports.ts";
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
	json("tsconfig.json", { compilerOptions: { ...COMPILER, paths: { "~kit/*": ["./packages/kit/src/*"] } } }),
	json("packages/app/package.json", { imports: { "#lib/*": "./src/lib/*", "#src/*": "./src/*" }, name: "@demo/app", type: "module" }),
	code(
		"packages/app/src/feature/forms.ts",
		'import type { Format } from "../lib/format.ts";',
		'import "../lib/side.ts";',
		'import { local } from "./local.ts";',
		'import { deeper } from "./parts/deeper.ts";',
		'export { format } from "../lib/format.ts";',
		'export const load = () => import("../lib/format.ts");',
		'vi.mock("../lib/format.ts", () => ({ format: () => "" }));',
		'export const actual = await vi.importActual<Format>("../lib/format.ts");',
		"export const both = [local, deeper];",
	),
	code("packages/app/src/feature/local.ts", "export const local = 1;"),
	code("packages/app/src/feature/parts/deeper.ts", "export const deeper = 2;"),
	code("packages/app/src/lib/format.ts", "export type Format = string;", "export const format = (value: string): Format => value;"),
	code("packages/app/src/lib/side.ts", "export {};"),
	code(
		"packages/app/src/kit-user.ts",
		'import { button } from "../../kit/src/button.ts";',
		'import { secret } from "../../kit/src/internal/secret.ts";',
		"export const used = [button, secret];",
	),
	json("packages/kit/package.json", { exports: { "./button": "./src/button.ts" }, name: "@demo/kit", type: "module" }),
	code("packages/kit/src/button.ts", "export const button = 1;"),
	code("packages/kit/src/internal/secret.ts", "export const secret = 2;"),
	json("packages/tools/package.json", { name: "@demo/tools", type: "module" }),
	json("packages/tools/tsconfig.json", { compilerOptions: { ...COMPILER, paths: { "@tools/*": ["./src/*"] } } }),
	code("packages/tools/src/cli/main.ts", 'import { helper } from "../util/helper";', "export const run = helper;"),
	code("packages/tools/src/util/helper.ts", "export const helper = 1;"),
	json("packages/game/package.json", {
		exports: { "./*.ts": "./*.ts" },
		imports: { "#game/*": "@demo/game/*", "#shared/*": "@demo/shared/*" },
		name: "@demo/game",
		type: "module",
	}),
	code(
		"packages/game/feature/play.ts",
		'import { core } from "../core/core.ts";',
		'import { util } from "../../shared/util.ts";',
		"export const play = [core, util];",
	),
	code("packages/game/core/core.ts", "export const core = 1;"),
	json("packages/shared/package.json", { exports: { "./*.ts": "./*.ts" }, name: "@demo/shared", type: "module" }),
	code("packages/shared/util.ts", "export const util = 1;"),
	code("packages/app/src/lib-user.ts", 'import { lib } from "../../lib/src/index.ts";', "export const used = lib;"),
	json("packages/lib/package.json", {
		exports: { ".": { default: "./dist/index.js", source: "./src/index.ts", types: "./dist/index.d.ts" } },
		name: "@demo/lib",
		type: "module",
	}),
	code("packages/lib/src/index.ts", "export const lib = 1;"),
	code("packages/lib/dist/index.js", "export const lib = 1;"),
	code("packages/lib/dist/index.d.ts", "export declare const lib: number;"),
	json("packages/web/package.json", {
		imports: { "#env/*": { default: "./src/env/prod/*", development: "./src/env/dev/*" } },
		name: "@demo/web",
		type: "module",
	}),
	code(
		"packages/web/src/feature/flags.ts",
		'import { flag } from "../env/prod/flag.ts";',
		'vi.mock("../env/prod/flag.ts", () => ({ flag: false }));',
		"export const flags = [flag];",
	),
	code("packages/web/src/env/prod/flag.ts", "export const flag = true;"),
	code("packages/web/src/env/dev/flag.ts", "export const flag = false;"),
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
	code("packages/app/src/feature/typed.ts", 'import { shape } from "../lib/shape";', "export const typed = shape;"),
	code("packages/app/src/lib/shape.d.ts", "export declare const shape: number;"),
	code("script/tasks/run.ts", 'import { tool } from "../lib/tool.ts";', "export const run = tool;"),
	code("script/lib/tool.ts", "export const tool = 1;"),
];

export function aliasRepository(...extra: readonly SeedFile[]): string {
	const root = seedTree(aliasTree, extra);
	linkWorkspace(root, "@demo/kit", "packages/kit");
	linkWorkspace(root, "@demo/shared", "packages/shared");
	linkWorkspace(root, "@demo/lib", "packages/lib");
	return root;
}
