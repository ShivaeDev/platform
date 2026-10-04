import { afterEach, describe, expect, it } from "vitest";
import type { Finding } from "../src/rule.ts";
import { importsAliased } from "../src/rules/imports/aliased.ts";
import { aliasRepository } from "./support/alias-tree.ts";
import { findingsIn } from "./support/imports.ts";
import { removeSeededTrees } from "./support/tree.ts";

afterEach(removeSeededTrees);

const REPLACEMENT = /Import it as "(?<alias>[^"]+)"/u;

function rewrites(findings: readonly Finding[]): readonly (readonly [string, string, string | undefined])[] {
	return findings.map((finding) => [`${finding.file}:${finding.line}`, finding.subject ?? "", REPLACEMENT.exec(finding.message)?.groups?.alias]);
}

describe("imports/aliased", () => {
	it("reports each relative import that leaves its folder, in every import form, with the alias that reaches the same file", async () => {
		const findings = await findingsIn(importsAliased, undefined, aliasRepository());
		expect(rewrites(findings)).toEqual([
			["packages/app/src/feature/forms.ts:1", "../lib/format.ts", "#lib/format.ts"],
			["packages/app/src/feature/forms.ts:2", "../lib/side.ts", "#lib/side.ts"],
			["packages/app/src/feature/forms.ts:4", "./parts/deeper.ts", "#src/feature/parts/deeper.ts"],
			["packages/app/src/feature/forms.ts:5", "../lib/format.ts", "#lib/format.ts"],
			["packages/app/src/feature/forms.ts:6", "../lib/format.ts", "#lib/format.ts"],
			["packages/app/src/feature/forms.ts:7", "../lib/format.ts", "#lib/format.ts"],
			["packages/app/src/feature/forms.ts:8", "../lib/format.ts", "#lib/format.ts"],
			["packages/app/src/kit-user.ts:1", "../../kit/src/button.ts", "@demo/kit/button"],
			["packages/app/src/kit-user.ts:2", "../../kit/src/internal/secret.ts", "~kit/internal/secret.ts"],
			["packages/game/feature/play.ts:1", "../core/core.ts", "#game/core/core.ts"],
			["packages/game/feature/play.ts:2", "../../shared/util.ts", "#shared/util.ts"],
			["packages/tools/src/cli/main.ts:1", "../util/helper", "@tools/util/helper"],
			["script/tasks/run.ts:1", "../lib/tool.ts", undefined],
		]);
		expect(findings[0]?.message).toBe('"../lib/format.ts" leaves its folder. Import it as "#lib/format.ts"; `quality fix` rewrites it.');
	});

	it("asks for an alias when none reaches the file", async () => {
		const findings = await findingsIn(importsAliased, undefined, aliasRepository());
		expect(findings.at(-1)?.message).toBe(
			'"../lib/tool.ts" leaves its folder. No alias reaches script/lib/tool.ts. Declare one in package.json "imports" or tsconfig "paths", then run `quality fix`.',
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
});
