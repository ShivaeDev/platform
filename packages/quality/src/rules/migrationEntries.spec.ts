import { expect } from "vitest";
import { unusedCode } from "#rules/unusedCode.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const MIGRATION = 'import { Effect } from "effect"; export default Effect.void;';

ruleStory.it(
	"code/unused treats numbered migrations as entries, because their runner loads them from the folder, and still reports an unnumbered module beside them",
	[
		repositoryHas(
			{ content: '{"name":"app","type":"module","dependencies":{"effect":"*"}}', path: "package.json" },
			{ content: '{"include":["src"]}', path: "tsconfig.json" },
			{ content: "export const app = 1;", path: "src/server/app.test.ts" },
			{ content: MIGRATION, path: "src/server/migrations/0001_accounts.ts" },
			{ content: MIGRATION, path: "src/modules/billing/server/migrations/0002_invoices.ts" },
			{ content: MIGRATION, path: "src/server/migrations/helpers.ts" },
		),
	],
	function* ({ check, locations }) {
		yield* check(unusedCode);

		expect(yield* locations()).toEqual(["src/server/migrations/helpers.ts"]);
	},
);
