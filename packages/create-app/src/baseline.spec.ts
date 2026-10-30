import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { application } from "#test/application.ts";
import { appAdds, generated, installedPackageManager, linkedPackageScripts } from "#test/traits.ts";

const DEBT = "src/test-support/debt.ts";

application.it(
	"pnpm baseline write --rule comments/no-todo records the app's new TODO in quality-baseline.jsonl",
	[
		linkedPackageScripts,
		installedPackageManager,
		generated("my-app"),
		appAdds(DEBT, "// TODO: finish the feature\nexport function debt() {\n\treturn 1;\n}\n"),
	],
	function* ({ baselineEntriesFor, pnpm, scriptResult }) {
		expect(yield* baselineEntriesFor(DEBT)).toEqual([]);

		yield* pnpm("baseline", "write", "--rule", "comments/no-todo");

		yield* outcomes({
			"baseline entries for the debt": [baselineEntriesFor(DEBT), [{ count: 1, rule: "comments/no-todo" }]],
			"pnpm baseline write": [scriptResult(), "passed"],
		});
	},
	120_000,
);
