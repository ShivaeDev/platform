import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { withMatchers } from "#testing/adapters/assertThat.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";
import { inStory } from "#testing/adapters/storySpecFiles.ts";

repositoryStory.it(
	"quality lint reports a real-time wait even when its story has a config exception",
	[
		qualityInstalled(),
		repositoryHas(
			{ content: inStory("Date.now();"), path: "src/orders.spec.ts" },
			{
				content: 'export default { exceptions: [{ files: ["src/orders.spec.ts"], reason: "An old wait.", rules: ["tests/wait-on-events"] }] };\n',
				path: "quality.config.ts",
			},
		),
	],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* withMatchers((expect) =>
			outcomes([
				["exit", () => outcome(), "rejected"],
				["finding", () => stdout(), expect.stringContaining("a wall-clock read such as Date.now()")],
				["exception", () => stdout(), expect.stringContaining("tests/wait-on-events src/orders.spec.ts names a rule that takes no exceptions")],
			]),
		);
	},
	CLI_TIMEOUT,
);
