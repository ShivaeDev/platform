import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#rule-story";
import { unusedCode } from "#rules/unusedCode.ts";

const MIGRATION = 'import { Effect } from "effect"; export default Effect.void;';
const project = repositoryHas(
	{ content: '{"name":"app","type":"module","dependencies":{"effect":"*"}}', path: "package.json" },
	{ content: '{"include":["src"]}', path: "tsconfig.json" },
	{ content: "export const app = 1;", path: "src/server/app.test.ts" },
	{ content: MIGRATION, path: "src/server/migrations/0001_accounts.ts" },
	{ content: MIGRATION, path: "src/modules/billing/server/migrations/0002_invoices.ts" },
	{ content: MIGRATION, path: "src/server/migrations/helpers.ts" },
);

ruleKit.it("treats numbered migrations as entries because their runner loads them from the directory", [project], function* ({ checks }) {
	const findings = yield* checks(unusedCode);
	expect(findings.map(({ file }) => file)).toEqual(["src/server/migrations/helpers.ts"]);
});
