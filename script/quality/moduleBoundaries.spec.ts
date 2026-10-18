import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";
import { httpStatus } from "#quality-internal/rules/stories/httpStatus.ts";
import { supportImports } from "#quality-internal/rules/stories/supportImports.ts";

ruleKit.it(
	"test-support cannot reach module internals through static or dynamic imports",
	[
		repositoryHas(
			{ content: 'import { save } from "../internal.ts"; const module = await import("../internal.ts");', path: "src/test-support/orders.ts" },
			{ content: "export const save = () => {};", path: "src/internal.ts" },
		),
	],
	function* ({ checks }) {
		const findings = yield* checks(supportImports, { modules: ["src/host.ts"] });
		expect(findings.map((finding) => finding.subject)).toEqual(["../internal.ts", "../internal.ts"]);
		expect(findings[0]?.message).toContain("Drive the app through its host");
	},
);

ruleKit.it(
	"test-support uses the configured public surface through resolved aliases",
	[
		repositoryHas(
			{ content: '{"type":"module","imports":{"#host":"./src/host.ts"}}', path: "package.json" },
			{
				content: 'import { host } from "#host"; import { helper } from "./helper.ts"; import { readFile } from "node:fs/promises";',
				path: "src/test-support/orders.ts",
			},
			{ content: "export const helper = true;", path: "src/test-support/helper.ts" },
			{ content: "export const host = {};", path: "src/host.ts" },
		),
	],
	function* ({ checks }) {
		expect(yield* checks(supportImports, { modules: ["src/host.ts"] })).toEqual([]);
	},
);

ruleKit.it(
	"an absent allowlist does not silently allow an app's internals",
	[
		repositoryHas(
			{ content: 'export { hidden } from "../internal.ts";', path: "src/test-support/orders.ts" },
			{ content: "export const hidden = true;", path: "src/internal.ts" },
		),
	],
	function* ({ checks }) {
		const findings = yield* checks(supportImports);
		expect(findings.map((finding) => finding.subject)).toEqual(["../internal.ts"]);
	},
);

ruleKit.it(
	"domain code handles typed errors instead of comparing HTTP error numbers",
	[
		repositoryHas({
			content:
				'if (error.status === 404) recover();\nconst missing = 404 === error["status"];\nswitch (error.status) { case 409: break; }\nif ([401, 403].includes(error.status)) deny();',
			path: "src/orders.ts",
		}),
	],
	function* ({ checks }) {
		const findings = yield* checks(httpStatus);
		expect(findings.map((finding) => finding.line)).toEqual([1, 2, 3, 4]);
		expect(findings[0]?.message).toContain("Handle the typed domain error");
	},
);

ruleKit.it(
	"the HTTP edge translates errors while domain code handles their tags",
	[
		repositoryHas(
			{ content: "if (error.status === 404) return notFound;", path: "src/http/orders.ts" },
			{ content: 'if (error._tag === "OrderMissing") recover(); if (processResult.status !== 0) fail();', path: "src/orders.ts" },
		),
	],
	function* ({ checks }) {
		expect(yield* checks(httpStatus, { edge: ["src/http/**"] })).toEqual([]);
	},
);
