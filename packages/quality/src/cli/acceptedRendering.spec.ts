import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adoption, jsxFixture } from "#test/adoption.ts";
import { jsxAccepted } from "#test/jsxConditionalFiles.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

for (const { code, name } of jsxAccepted) {
	adoption.it(
		`the JSX fix accepts ${name} and leaves its source unchanged`,
		[jsxFixture(code)],
		function* ({ fix, outcome, source }) {
			yield* fix("react/jsx-conditionals");

			yield* outcomes([
				["fix", () => outcome(), "passed"],
				["source", () => source(), code],
			]);
		},
		CLI_TIMEOUT,
	);
}
