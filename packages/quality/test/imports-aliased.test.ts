import { afterEach, describe, expect, it } from "vitest";
import type { Finding } from "../src/rule.ts";
import { importsAliased } from "../src/rules/imports/aliased.ts";
import { aliasRepository } from "./support/alias-tree.ts";
import { findingsIn } from "./support/imports.ts";
import { removeSeededTrees } from "./support/tree.ts";

afterEach(removeSeededTrees);

function sites(findings: readonly Finding[]): readonly string[] {
	return findings.map((finding) => `${finding.file}:${finding.line} ${finding.subject}`);
}

function messageAt(findings: readonly Finding[], file: string): string | undefined {
	return findings.find((finding) => finding.file === file)?.message;
}

describe("imports/aliased", () => {
	it("reports each relative import that leaves its folder, in every import form, and no other import", async () => {
		const findings = await findingsIn(importsAliased, undefined, aliasRepository());
		expect(sites(findings)).toEqual([
			"packages/app/src/feature/described.js:1 ../lib/format.ts",
			"packages/app/src/feature/documented.ts:1 ../lib/format.ts",
			"packages/app/src/feature/escaped.ts:1 ../lib/format.ts",
			"packages/app/src/feature/escaped.ts:2 ../lib/side.ts",
			"packages/app/src/feature/forms.ts:1 ../lib/format.ts",
			"packages/app/src/feature/forms.ts:2 ../lib/side.ts",
			"packages/app/src/feature/forms.ts:4 ./parts/deeper.ts",
			"packages/app/src/feature/forms.ts:5 ../lib/format.ts",
			"packages/app/src/feature/forms.ts:6 ../lib/format.ts",
			"packages/app/src/feature/forms.ts:7 ../lib/side.ts",
			"packages/app/src/feature/forms.ts:8 ../lib/format.ts",
			"packages/app/src/feature/forms.ts:9 ../lib/format.ts",
			"packages/app/src/feature/prose.ts:3 ../lib/format.ts",
			"packages/app/src/kit-user.ts:1 ../../kit/src/button.ts",
			"packages/app/src/lib/uses.ts:1 ./widgets",
			"packages/app/src/lib/uses.ts:2 ../ghost.ts",
			"packages/app/src/vendor-user.ts:1 ../../../node_modules/left-pad/index.js",
			"script/tasks/run.ts:1 ../lib/tool.ts",
		]);
	});

	it("tells the author to import through a package.json imports alias, by the other workspace package's name, or by the installed package's name", async () => {
		const findings = await findingsIn(importsAliased, undefined, aliasRepository());
		expect(messageAt(findings, "packages/app/src/feature/forms.ts")).toBe(
			'"../lib/format.ts" leaves its folder. Import it through a "#…" alias from the "imports" of its package.json, and declare one there if none fits.',
		);
		expect(messageAt(findings, "packages/app/src/kit-user.ts")).toBe(
			'"../../kit/src/button.ts" leaves its folder. It reaches into the workspace package @demo/kit; import it by that name, through a path its package.json "exports" lists.',
		);
		expect(messageAt(findings, "packages/app/src/vendor-user.ts")).toBe(
			'"../../../node_modules/left-pad/index.js" leaves its folder. It reaches into the installed package left-pad; import that package by its name.',
		);
	});
});
