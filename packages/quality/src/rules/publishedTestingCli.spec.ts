import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { manifestStory, repositoryHas } from "#test/manifestStory.ts";
import { publishedTestingFiles, RUNTIME_MANIFEST } from "#test/publishedTestingFiles.ts";
import { withMatchers } from "#testing/adapters/assertThat.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

manifestStory.it(
	"quality lint rejects a runtime package's test-story peer and names the test-kits repair without rule configuration",
	[repositoryHas(...publishedTestingFiles({ peerDependencies: { "@shivaedev/test-story": "1.0.0" } }))],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* withMatchers((expect) =>
			outcomes([
				["gate", () => outcome(), "rejected"],
				["rule", () => stdout(), expect.stringContaining("error manifests/no-test-kits (1)")],
				[
					"finding",
					() => stdout(),
					expect.stringContaining(
						`${RUNTIME_MANIFEST}  Runtime package "@acme/runtime" declares test package "@shivaedev/test-story" in peerDependencies. Move the helper into @shivaedev/test-kits`,
					),
				],
			]),
		);
	},
	CLI_TIMEOUT,
);
