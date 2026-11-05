import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { application } from "#test/application.ts";

application.it(
	"the starter passes the real Quality gate with its recorded template findings",
	[],
	function* ({ lintStarter, scriptResult }) {
		yield* lintStarter();

		yield* outcomes([["Quality gate", () => scriptResult(), "passed"]]);
	},
	120_000,
);
