import { expect } from "vitest";
import { unusedCode } from "#rules/unusedCode.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const MIGRATION = 'import { Effect } from "effect"; export default Effect.void;';

ruleStory.it(
	"code/unused treats every module in a migration folder as an entry, because the runner loads the folder, and still reports a module outside it",
	[
		repositoryHas(
			{ content: '{"name":"app","type":"module","dependencies":{"effect":"*"}}', path: "package.json" },
			{ content: '{"include":["src"]}', path: "tsconfig.json" },
			{ content: "export const app = 1;", path: "src/server/app.test.ts" },
			{ content: MIGRATION, path: "src/server/migrations/0001_accounts.ts" },
			{ content: MIGRATION, path: "src/modules/billing/server/migrations/0002_invoices.ts" },
			{ content: MIGRATION, path: "src/server/migrations/helpers.ts" },
			{ content: MIGRATION, path: "src/server/abandoned.ts" },
		),
	],
	function* ({ check, locations }) {
		yield* check(unusedCode);

		expect(yield* locations()).toEqual(["src/server/abandoned.ts"]);
	},
);
