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

const BUILT = '{ "#*.ts": { "source": "./src/*.ts", "types": "./dist/*.d.ts", "default": "./dist/*.js" } }';

const NESTED = '{ "#*.ts": { "source": "./src/*.ts", "types": "./dist/src/*.d.ts", "default": "./dist/src/*.js" } }';

const TYPES_FIRST = '{ "#*.ts": { "types": "./dist/*.d.ts", "source": "./src/*.ts", "default": "./dist/*.js" } }';

const EMIT = { compilerOptions: { declaration: true, outDir: "dist", rootDir: "src" }, include: ["src"] };

const SOURCE_PROJECT = { compilerOptions: { customConditions: ["source"] }, extends: "../../tsconfig.json" };

const MAPPING_PROJECT = { compilerOptions: { declaration: true, outDir: "dist", rootDir: "src" }, extends: "../../tsconfig.json" };

interface BuiltShape {
	readonly build?: unknown;
	readonly imports?: string;
	readonly project?: unknown;
	readonly scripts?: string;
}

function builtPackage(directory: string, shape: BuiltShape): readonly SeedFile[] {
	const name = `@demo/${directory.split("/").at(-1)}`;
	const scripts = shape.scripts ?? '{ "build": "tsc -p tsconfig.emit.json", "typecheck": "tsc --noEmit" }';
	return [
		{
			content: `{ "imports": ${shape.imports ?? BUILT}, "name": "${name}", "scripts": ${scripts}, "type": "module" }\n`,
			path: `${directory}/package.json`,
		},
		...(shape.build === undefined ? [] : [json(`${directory}/tsconfig.emit.json`, shape.build)]),
		...(shape.project === undefined ? [] : [json(`${directory}/tsconfig.json`, shape.project)]),
		code(`${directory}/src/feature/use.ts`, 'import { x } from "../lib/x.ts";', "export const used = x;"),
		code(`${directory}/src/lib/x.ts`, "export const x = 1;"),
	];
}

function staleOutput(directory: string): readonly SeedFile[] {
	return [code(`${directory}/dist/lib/x.js`, "export const x = 0;"), code(`${directory}/dist/lib/x.d.ts`, "export declare const x: number;")];
}

const EMITTING_PROJECT = {
	compilerOptions: { ...COMPILER, customConditions: ["source"], declaration: true, noEmit: false, outDir: "dist", rootDir: "." },
	include: ["src"],
};

export const builtPackages: readonly SeedFile[] = [
	...builtPackage("packages/built", { build: EMIT, project: SOURCE_PROJECT }),
	...builtPackage("packages/shipped", { build: EMIT, project: SOURCE_PROJECT }),
	...staleOutput("packages/shipped"),
	...builtPackage("packages/bare", { build: EMIT }),
	...builtPackage("packages/stale", { build: EMIT }),
	...staleOutput("packages/stale"),
	...builtPackage("packages/elsewhere", { build: { ...EMIT, compilerOptions: { ...EMIT.compilerOptions, outDir: "out" } }, project: SOURCE_PROJECT }),
	...builtPackage("packages/unbuilt", { project: SOURCE_PROJECT }),
	...builtPackage("packages/split", { build: EMIT, imports: NESTED, project: EMITTING_PROJECT }),
	...builtPackage("packages/fallback", { project: SOURCE_PROJECT, scripts: "{}" }),
	json("packages/fallback/tsconfig.build.json", EMIT),
	...builtPackage("packages/torn", { project: EMITTING_PROJECT, scripts: "{}" }),
	json("packages/torn/tsconfig.build.json", EMIT),
	...builtPackage("packages/flagged", { build: EMIT, project: SOURCE_PROJECT, scripts: '{ "build": "tsc -p tsconfig.emit.json --outDir lib" }' }),
	...builtPackage("packages/broken", { build: { ...EMIT, extends: "./missing.json" }, project: SOURCE_PROJECT }),
	...builtPackage("packages/mapped", { build: EMIT, project: MAPPING_PROJECT }),
	...staleOutput("packages/mapped"),
	...builtPackage("packages/mappedbare", { build: EMIT, project: MAPPING_PROJECT }),
	...builtPackage("packages/mappedsource", {
		build: EMIT,
		project: { ...MAPPING_PROJECT, compilerOptions: { ...MAPPING_PROJECT.compilerOptions, customConditions: ["source"] } },
	}),
	...builtPackage("packages/typesfirst", { build: EMIT, imports: TYPES_FIRST, project: SOURCE_PROJECT }),
	...staleOutput("packages/typesfirst"),
];

export const fallbacklessEntries: readonly SeedFile[] = [
	json("packages/strict/package.json", {
		imports: { "#b/*": { development: "./src/b/*", types: "./src/b/*" }, "#c/*": { import: "./src/c/*" } },
		name: "@demo/strict",
		type: "module",
	}),
	code("packages/strict/src/a/use.ts", 'import { t } from "../b/t.ts";', "export const used = t;"),
	code("packages/strict/src/a/load.cts", 'const { c } = require("../c/c.ts");', "export = c;"),
	code("packages/strict/src/b/t.ts", "export const t = 1;"),
	code("packages/strict/src/c/c.ts", "export const c = 1;"),
	json("packages/gated/package.json", {
		exports: { ".": { development: "./src/index.ts", types: "./src/index.ts" } },
		name: "@demo/gated",
		type: "module",
	}),
	code("packages/gated/src/index.ts", "export const gated = 1;"),
	code("packages/app/src/gated-user.ts", 'import { gated } from "../../gated/src/index.ts";', "export const used = gated;"),
];

export const mainPackage: readonly SeedFile[] = [
	json("packages/plain/package.json", { main: "./src/index.ts", name: "@demo/plain", type: "module" }),
	json("packages/typedmain/package.json", { main: "./src/index.ts", name: "@demo/typedmain", type: "module", types: "./types/index.d.ts" }),
	code("packages/typedmain/src/index.ts", "export const typed = 1;"),
	code("packages/typedmain/types/index.d.ts", "export declare const typed: number;"),
	code("packages/plain/src/index.ts", "export const plain = 1;"),
	code("packages/plain/src/other.ts", "export const other = 1;"),
	code(
		"packages/app/src/plain-user.ts",
		'import { plain } from "../../plain/src/index.ts";',
		'import { other } from "../../plain/src/other.ts";',
		"export const used = [plain, other];",
	),
	code("packages/app/src/typedmain-user.ts", 'import { typed } from "../../typedmain/src/index.ts";', "export const used = typed;"),
];

export const jsDocProse: SeedFile = code(
	"packages/app/src/feature/prose.ts",
	"/**",
	' * Prefer @import over a require call, it reads from "../lib/side.ts" lazily.',
	' * @import { Format } from "../lib/format.ts"',
	" */",
	'export const prose: Format = "";',
);

export function aliasRepository(...extra: readonly SeedFile[]): string {
	const root = seedTree(aliasTree, extra);
	linkWorkspace(root, "@demo/kit", "packages/kit");
	linkWorkspace(root, "@demo/shared", "packages/shared");
	linkWorkspace(root, "@demo/lib", "packages/lib");
	if (extra.some((file) => file.path.startsWith("packages/gated/"))) {
		linkWorkspace(root, "@demo/gated", "packages/gated");
	}
	if (extra.some((file) => file.path.startsWith("packages/plain/"))) {
		linkWorkspace(root, "@demo/plain", "packages/plain");
		linkWorkspace(root, "@demo/typedmain", "packages/typedmain");
	}
	return root;
}
