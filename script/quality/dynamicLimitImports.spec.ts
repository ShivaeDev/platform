import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";
import { noLimitImports } from "#quality-internal/rules/stories/noLimitImports.ts";

ruleKit.it(
	"a spec cannot load implementation caps through literal dynamic limits imports",
	[
		repositoryHas({
			content: [
				'export {}; const { MAX_ITEMS } = await import("./limits.ts");',
				'const { MAX_ITEMS: cap } = await (import("#limits.ts"));',
				'async function run() { const { "MAX_JOBS": jobs, ["MAX_SIZE"]: size } = await import(`./limits.ts`); }',
				'const limits = await import("./limits.ts"); limits.MAX_ITEMS;',
			].join("\n"),
			path: "src/orders.spec.ts",
		}),
	],
	function* ({ checks }) {
		const findings = yield* checks(noLimitImports);
		expect(findings.map((finding) => finding.line)).toEqual([1, 2, 3, 3, 4]);
	},
);

ruleKit.it(
	"dynamic imports may load observations and app source may use its caps",
	[
		repositoryHas(
			{
				content: 'const { itemSchema: MAX_FIELDS_ALIAS } = await import("./limits.ts"); const { MAX_FIELDS } = await import("./schemas.ts");',
				path: "src/orders.spec.ts",
			},
			{ content: 'const { MAX_ITEMS } = await import("./limits.ts");', path: "src/orders.ts" },
		),
	],
	function* ({ checks }) {
		expect(yield* checks(noLimitImports)).toEqual([]);
	},
);
