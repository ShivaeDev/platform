import { expect } from "vitest";
import { httpStatus } from "@shivaedev/quality/rules/stories/httpStatus.ts";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";

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
