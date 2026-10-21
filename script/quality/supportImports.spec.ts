import { expect } from "vitest";
import { importsWorkspace } from "#quality/test-support/importsWorkspace.ts";
import { ruleKit } from "#quality/test-support/ruleKit.ts";
import { supportImports } from "#quality-internal/rules/stories/supportImports.ts";

ruleKit.it("a kit drives its own package's exports through the package name and its aliases", [importsWorkspace], function* ({ checks, writes }) {
	yield* writes({
		content: 'import { orders } from "@example/orders/orders.ts"; import { orders as own } from "#orders.ts";',
		path: "modules/orders/src/test-support/orders.ts",
	});
	expect(yield* checks(supportImports)).toEqual([]);
});

ruleKit.it("a kit drives another workspace package's exports", [importsWorkspace], function* ({ checks, linksWorkspace, writes }) {
	yield* linksWorkspace("@example/prices", "modules/prices");
	yield* writes({
		content: 'import { prices } from "@example/prices/prices.ts";',
		path: "modules/orders/src/test-support/orders.ts",
	});
	expect(yield* checks(supportImports)).toEqual([]);
});

ruleKit.it(
	"exports admit the public engine while exact and wildcard null blocks keep internals closed",
	[importsWorkspace],
	function* ({ checks, writes }) {
		yield* writes({
			content: 'import { orders } from "#orders.ts"; import { internal } from "#internal.ts"; import { secret } from "#internal/secret.ts";',
			path: "modules/orders/src/test-support/orders.ts",
		});
		expect((yield* checks(supportImports)).map((finding) => finding.subject)).toEqual(["#internal.ts", "#internal/secret.ts"]);
		expect(yield* checks(supportImports, { modules: ["modules/orders/src/internal.ts", "modules/orders/src/internal/**"] })).toEqual([]);
	},
);

ruleKit.it("a private workspace package without exports keeps its module allowlist", [importsWorkspace], function* ({ checks, writes }) {
	yield* writes({
		content: 'import { orders } from "#orders.ts";',
		path: "modules/orders/src/test-support/orders.ts",
	});
	expect(yield* checks(supportImports)).toEqual([]);
	yield* writes({
		content: '{"imports":{"#*.ts":"./src/*.ts"},"name":"@example/orders","private":true,"type":"module"}',
		path: "modules/orders/package.json",
	});
	expect((yield* checks(supportImports)).map((finding) => finding.subject)).toEqual(["#orders.ts"]);
	expect(yield* checks(supportImports, { modules: ["modules/orders/src/orders.ts"] })).toEqual([]);
});
