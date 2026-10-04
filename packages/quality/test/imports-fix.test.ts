import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { aliasRepository } from "./support/alias-tree.ts";
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
		expect(quality(root, "fix").stdout).toContain("quality: rewrote 12 imports in 4 files to an alias.\n");
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
		expect(read(root, "packages/tools/src/cli/main.ts")).toContain('import { helper } from "@tools/util/helper";');
		expect(read(root, "script/tasks/run.ts")).toContain('import { tool } from "../lib/tool.ts";');
	});

	it("leaves an import the registry excuses, and every import while the rule is off", () => {
		const excuse = {
			content: `${JSON.stringify([{ file: "packages/app/src/kit-user.ts", reason: "Kept for the demo.", rule: "imports/aliased", subject: "../../kit/src/button.ts" }])}\n`,
			path: "quality/registry.json",
		};
		const excused = repository("{}", excuse);
		quality(excused, "fix");
		expect(read(excused, "packages/app/src/kit-user.ts")).toContain('import { button } from "../../kit/src/button.ts";');
		expect(read(excused, "packages/app/src/kit-user.ts")).toContain('import { secret } from "~kit/internal/secret.ts";');
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
