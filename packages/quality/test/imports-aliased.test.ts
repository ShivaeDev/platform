import { afterEach, describe, expect, it } from "vitest";
import type { Finding } from "../src/rule.ts";
import { importsAliased } from "../src/rules/imports/aliased.ts";
import { aliasRepository, builtPackages, fallbacklessEntries, jsDocProse, mainPackage } from "./support/alias-tree.ts";
import { findingsIn } from "./support/imports.ts";
import { removeSeededTrees } from "./support/tree.ts";

afterEach(removeSeededTrees);

const REPLACEMENT = /Import it as "(?<alias>[^"]+)"/u;

function rewrites(findings: readonly Finding[]): readonly (readonly [string, string, string | undefined])[] {
	return findings.map((finding) => [`${finding.file}:${finding.line}`, finding.subject ?? "", REPLACEMENT.exec(finding.message)?.groups?.alias]);
}

describe("imports/aliased", () => {
	it("reports each relative import that leaves its folder, in every import form, with the alias that loads the same file", async () => {
		const findings = await findingsIn(importsAliased, undefined, aliasRepository());
		expect(rewrites(findings)).toEqual([
			["packages/app/src/feature/described.js:1", "../lib/format.ts", "#lib/format.ts"],
			["packages/app/src/feature/documented.ts:1", "../lib/format.ts", "#lib/format.ts"],
			["packages/app/src/feature/forms.ts:1", "../lib/format.ts", "#lib/format.ts"],
			["packages/app/src/feature/forms.ts:2", "../lib/side.ts", "#lib/side.ts"],
			["packages/app/src/feature/forms.ts:4", "./parts/deeper.ts", "#src/feature/parts/deeper.ts"],
			["packages/app/src/feature/forms.ts:5", "../lib/format.ts", "#lib/format.ts"],
			["packages/app/src/feature/forms.ts:6", "../lib/format.ts", "#lib/format.ts"],
			["packages/app/src/feature/forms.ts:7", "../lib/format.ts", "#lib/format.ts"],
			["packages/app/src/feature/forms.ts:8", "../lib/format.ts", "#lib/format.ts"],
			["packages/app/src/feature/typed.ts:1", "../lib/shape", undefined],
			["packages/app/src/kit-user.ts:1", "../../kit/src/button.ts", "@demo/kit/button"],
			["packages/app/src/kit-user.ts:2", "../../kit/src/internal/secret.ts", undefined],
			["packages/app/src/lib-user.ts:1", "../../lib/src/index.ts", undefined],
			["packages/game/feature/play.ts:1", "../core/core.ts", "#game/core/core.ts"],
			["packages/game/feature/play.ts:2", "../../shared/util.ts", "#shared/util.ts"],
			["packages/tools/src/cli/main.ts:1", "../util/helper", undefined],
			["packages/web/src/feature/flags.ts:1", "../env/prod/flag.ts", undefined],
			["packages/web/src/feature/flags.ts:2", "../env/prod/flag.ts", undefined],
			["script/tasks/run.ts:1", "../lib/tool.ts", undefined],
		]);
		expect(findings[2]?.message).toBe('"../lib/format.ts" leaves its folder. Import it as "#lib/format.ts"; `quality fix` rewrites it.');
	});

	it("never offers an alias that loads another file under some condition", async () => {
		const findings = await findingsIn(importsAliased, undefined, aliasRepository());
		function message(file: string): string | undefined {
			return findings.find((finding) => finding.file === file)?.message;
		}
		expect(message("packages/app/src/lib-user.ts")).toBe(
			'"../../lib/src/index.ts" leaves its folder. No package.json alias loads packages/lib/src/index.ts under every condition. Declare one in package.json "imports", then run `quality fix`.',
		);
		expect(message("packages/web/src/feature/flags.ts")).toContain(
			"No package.json alias loads packages/web/src/env/prod/flag.ts under every condition.",
		);
	});

	it("never offers a tsconfig path, which a bundler or Node may not read", async () => {
		const findings = await findingsIn(importsAliased, undefined, aliasRepository());
		expect(findings.find((finding) => finding.file === "packages/tools/src/cli/main.ts")?.message).toBe(
			'"../util/helper" leaves its folder. No package.json alias loads packages/tools/src/util/helper.ts under every condition. Declare one in package.json "imports", then run `quality fix`.',
		);
	});

	it("says when a runtime import reaches only a declaration file", async () => {
		const findings = await findingsIn(importsAliased, undefined, aliasRepository());
		expect(findings.find((finding) => finding.file === "packages/app/src/feature/typed.ts")?.message).toBe(
			'"../lib/shape" leaves its folder. It resolves only to a declaration file, which a runtime import cannot load, so no alias can stand in for it.',
		);
	});

	it("reports an import of a folder's index from the folder above, and one that resolves to nothing", async () => {
		const findings = await findingsIn(
			importsAliased,
			undefined,
			aliasRepository(
				{
					content: 'import { a } from "./widgets";\nimport { b } from "../ghost.ts";\nexport const c = [a, b];\n',
					path: "packages/app/src/lib/uses.ts",
				},
				{ content: "export const a = 1;\n", path: "packages/app/src/lib/widgets/index.ts" },
			),
		);
		const own = findings.filter((finding) => finding.file === "packages/app/src/lib/uses.ts");
		expect(rewrites(own)).toEqual([
			["packages/app/src/lib/uses.ts:1", "./widgets", "#lib/widgets/index.ts"],
			["packages/app/src/lib/uses.ts:2", "../ghost.ts", undefined],
		]);
		expect(own[1]?.message).toBe(
			'"../ghost.ts" leaves its folder. It resolves to no file yet, so no alias can stand in for it. Import it through an alias once it exists.',
		);
	});

	it("never offers an entry that some environment matches with no branch", async () => {
		const findings = await findingsIn(importsAliased, undefined, aliasRepository(...fallbacklessEntries));
		const strict = findings.filter((finding) => finding.file.startsWith("packages/strict/") || finding.file === "packages/app/src/gated-user.ts");
		expect(rewrites(strict)).toEqual([
			["packages/app/src/gated-user.ts:1", "../../gated/src/index.ts", undefined],
			["packages/strict/src/a/load.cts:1", "../c/c.ts", undefined],
			["packages/strict/src/a/use.ts:1", "../b/t.ts", undefined],
		]);
	});

	it("counts a package's build output as the module its source file builds", async () => {
		const findings = await findingsIn(importsAliased, undefined, aliasRepository(...builtPackages));
		const built = findings.filter((finding) => finding.file.endsWith("/src/feature/use.ts"));
		expect(rewrites(built)).toEqual([
			["packages/built/src/feature/use.ts:1", "../lib/x.ts", "#lib/x.ts"],
			["packages/elsewhere/src/feature/use.ts:1", "../lib/x.ts", undefined],
			["packages/shipped/src/feature/use.ts:1", "../lib/x.ts", "#lib/x.ts"],
			["packages/unbuilt/src/feature/use.ts:1", "../lib/x.ts", undefined],
		]);
	});

	it("offers the bare name of a package whose main is the file and that has no exports", async () => {
		const findings = await findingsIn(importsAliased, undefined, aliasRepository(...mainPackage));
		expect(rewrites(findings.filter((finding) => finding.file === "packages/app/src/plain-user.ts"))).toEqual([
			["packages/app/src/plain-user.ts:1", "../../plain/src/index.ts", "@demo/plain"],
			["packages/app/src/plain-user.ts:2", "../../plain/src/other.ts", undefined],
		]);
	});

	it("reads @import only as a JSDoc tag, not in prose", async () => {
		const findings = await findingsIn(importsAliased, undefined, aliasRepository(jsDocProse));
		expect(rewrites(findings.filter((finding) => finding.file === jsDocProse.path))).toEqual([
			["packages/app/src/feature/prose.ts:3", "../lib/format.ts", "#lib/format.ts"],
		]);
	});
});
