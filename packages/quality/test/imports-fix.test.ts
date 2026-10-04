import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execPath } from "node:process";
import { afterEach, describe, expect, it } from "vitest";
import { aliasRepository, builtPackages, fallbacklessEntries } from "./support/alias-tree.ts";
import { quality } from "./support/cli.ts";
import { git } from "./support/git.ts";
import { config, linkPackage, removeSeededTrees, type SeedFile } from "./support/tree.ts";

afterEach(removeSeededTrees);

const cliTimeout = 60_000;

function repository(rules: string, ...extra: readonly SeedFile[]): string {
	const root = aliasRepository(
		config(`{ sources: ["packages", "script"], rules: ${rules} }`),
		{ content: '{ "extends": ["@shivaedev/quality/biome"] }\n', path: "biome.json" },
		{ content: "node_modules/\n", path: ".gitignore" },
		...extra,
	);
	linkPackage(root);
	git(root, "init", "--quiet");
	return root;
}

function read(root: string, path: string): string {
	return readFileSync(join(root, path), "utf8");
}

describe("quality fix with imports/aliased", { timeout: cliTimeout }, () => {
	it("rewrites imports, type imports, side-effect imports, re-exports, dynamic imports and vi mocks to the same alias", () => {
		const root = repository("{}");
		expect(quality(root, "fix").stdout).toContain("quality: rewrote 12 imports in 5 files to an alias.\n");
		expect(read(root, "packages/app/src/feature/forms.ts")).toBe(
			[
				'import type { Format } from "#lib/format.ts";',
				'import "#lib/side.ts";',
				'import { deeper } from "#src/feature/parts/deeper.ts";',
				'import { local } from "./local.ts";',
				"",
				'export { format } from "#lib/format.ts";',
				'export const load = () => import("#lib/format.ts");',
				'vi.mock("#lib/format.ts", () => ({ format: () => "" }));',
				'export const actual = await vi.importActual<Format>("#lib/format.ts");',
				"export const both = [local, deeper];",
				"",
			].join("\n"),
		);
		expect(read(root, "packages/app/src/kit-user.ts")).toContain('import { button } from "@demo/kit/button";');
		expect(read(root, "packages/game/feature/play.ts")).toContain('import { util } from "#shared/util.ts";');
		expect(read(root, "packages/app/src/feature/documented.ts")).toContain('/** @import { Format } from "#lib/format.ts" */');
		expect(read(root, "packages/app/src/feature/described.js")).toContain('/** @import { Format } from "#lib/format.ts" */');
		expect(read(root, "script/tasks/run.ts")).toContain('import { tool } from "../lib/tool.ts";');
	});

	it("leaves an import whose only alias loads another file under some condition, mocks included", () => {
		const root = repository("{}");
		quality(root, "fix");
		expect(read(root, "packages/app/src/lib-user.ts")).toContain('import { lib } from "../../lib/src/index.ts";');
		expect(read(root, "packages/web/src/feature/flags.ts")).toBe(
			[
				'import { flag } from "../env/prod/flag.ts";',
				"",
				'vi.mock("../env/prod/flag.ts", () => ({ flag: false }));',
				"export const flags = [flag];",
				"",
			].join("\n"),
		);
	});

	it("rewrites to an alias whose other conditions load the build output, which Node then resolves", () => {
		const root = repository("{}", ...builtPackages);
		quality(root, "fix");
		function resolved(directory: string, ...conditions: readonly string[]): string {
			const script = 'console.log(import.meta.resolve("#lib/x.ts"))';
			const flags = conditions.map((condition) => `--conditions=${condition}`);
			const url = execFileSync(execPath, [...flags, "--input-type=module", "--eval", script], {
				cwd: join(root, directory),
				encoding: "utf8",
			});
			return url.trim().slice(url.trim().indexOf(`/${directory}/`) + directory.length + 2);
		}
		for (const directory of ["packages/built", "packages/shipped"]) {
			expect(read(root, `${directory}/src/feature/use.ts`)).toContain('import { x } from "#lib/x.ts";');
			expect(resolved(directory, "source")).toBe("src/lib/x.ts");
		}
		expect(resolved("packages/shipped")).toBe("dist/lib/x.js");
		expect(read(root, "packages/elsewhere/src/feature/use.ts")).toContain('import { x } from "../lib/x.ts";');
		expect(read(root, "packages/unbuilt/src/feature/use.ts")).toContain('import { x } from "../lib/x.ts";');
	});

	it("leaves an import whose alias some environment matches with no branch", () => {
		const root = repository("{}", ...fallbacklessEntries);
		quality(root, "fix");
		expect(read(root, "packages/strict/src/a/use.ts")).toContain('import { t } from "../b/t.ts";');
		expect(read(root, "packages/strict/src/a/load.cts")).toContain('require("../c/c.ts")');
		expect(read(root, "packages/app/src/gated-user.ts")).toContain('import { gated } from "../../gated/src/index.ts";');
	});

	it("never rewrites to a tsconfig path", () => {
		const root = repository("{}");
		quality(root, "fix");
		expect(read(root, "packages/tools/src/cli/main.ts")).toContain('import { helper } from "../util/helper";');
		expect(read(root, "packages/app/src/kit-user.ts")).toContain('import { secret } from "../../kit/src/internal/secret.ts";');
	});

	it("keeps a byte order mark", () => {
		const marked: SeedFile = {
			content: '\uFEFFimport { format } from "../lib/format.ts";\n\nexport const marked = format;\n',
			path: "packages/app/src/feature/marked.ts",
		};
		const root = repository("{}", marked);
		quality(root, "fix");
		expect(read(root, marked.path)).toBe('\uFEFFimport { format } from "#lib/format.ts";\n\nexport const marked = format;\n');
	});

	it("leaves an import the registry excuses, and every import while the rule is off", () => {
		const excuse = {
			content: `${JSON.stringify([{ file: "packages/app/src/kit-user.ts", reason: "Kept for the demo.", rule: "imports/aliased", subject: "../../kit/src/button.ts" }])}\n`,
			path: "quality/registry.json",
		};
		const excused = repository("{}", excuse);
		quality(excused, "fix");
		expect(read(excused, "packages/app/src/kit-user.ts")).toContain('import { button } from "../../kit/src/button.ts";');
		const off = repository('{ "imports/aliased": "off" }');
		expect(quality(off, "fix").stdout).toContain("quality: rewrote 0 imports in 0 files to an alias.\n");
		expect(read(off, "packages/game/feature/play.ts")).toContain('import { core } from "../core/core.ts";');
	});

	it("groups imports as builtins, packages, @shivaedev packages, aliases and same-folder paths", () => {
		const mixed: SeedFile = {
			content: [
				'import { local } from "./local.ts";',
				'import { format } from "../lib/format.ts";',
				'import { quality } from "@shivaedev/quality";',
				'import { Effect } from "effect";',
				'import { test } from "bun:test";',
				'import { scoped } from "@scope/thing";',
				'import { readFileSync } from "node:fs";',
				"export const all = [local, format, quality, Effect, test, scoped, readFileSync];",
				"",
			].join("\n"),
			path: "packages/app/src/feature/mixed.ts",
		};
		const root = repository("{}", mixed);
		quality(root, "fix");
		expect(read(root, mixed.path)).toBe(
			[
				'import { test } from "bun:test";',
				'import { readFileSync } from "node:fs";',
				'import { scoped } from "@scope/thing";',
				'import { Effect } from "effect";',
				'import { quality } from "@shivaedev/quality";',
				'import { format } from "#lib/format.ts";',
				'import { local } from "./local.ts";',
				"export const all = [local, format, quality, Effect, test, scoped, readFileSync];",
				"",
			].join("\n"),
		);
	});
});
