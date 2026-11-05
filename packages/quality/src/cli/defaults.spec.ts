import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { assertThat, withMatchers } from "#testing/adapters/assertThat.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

const TODO = { content: "// TODO\nexport function value(): number {\n\treturn 1;\n}\n", path: "src/value.ts" };
const CLEAN = { content: "export function value(): number {\n\treturn 1;\n}\n", path: "src/value.ts" };

repositoryStory.it(
	"quality without a config fixes a clean repository with the shared defaults",
	[qualityInstalled(), repositoryHas(CLEAN)],
	function* ({ spawns }) {
		const answer = yield* spawns("fix");

		yield* assertThat(answer.outcome, (actual) => actual.toBe("passed"));
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality without a config and without a command lints a clean repository with the shared defaults and reports that it passed",
	[qualityInstalled(), repositoryHas(CLEAN)],
	function* ({ outcome, spawns, stdout }) {
		yield* spawns();

		yield* withMatchers((expect) =>
			outcomes([
				["exit", () => outcome(), "passed"],
				["report", () => stdout(), expect.stringContaining("quality: passed.")],
			]),
		);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality without a config rejects a finding of the shared defaults and names its rule",
	[qualityInstalled(), repositoryHas(TODO)],
	function* ({ outcome, spawns, stdout }) {
		yield* spawns("lint");

		yield* withMatchers((expect) =>
			outcomes([
				["exit", () => outcome(), "rejected"],
				["report", () => stdout(), expect.stringContaining("comments/no-todo")],
			]),
		);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality without a config passes lint once baseline write records the existing finding",
	[qualityInstalled(), repositoryHas(TODO)],
	function* ({ spawns }) {
		yield* assertThat((yield* spawns("lint")).outcome, (actual) => actual.toBe("rejected"));

		yield* spawns("baseline", "write");

		yield* assertThat((yield* spawns("lint")).outcome, (actual) => actual.toBe("passed"));
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality without a config prunes a baseline whose recorded finding remains",
	[qualityInstalled(), repositoryHas(TODO)],
	function* ({ outcome, reads, spawns }) {
		yield* spawns("baseline", "write");
		const recorded = yield* reads("quality-baseline.jsonl");

		yield* spawns("baseline", "prune");

		yield* outcomes([
			["baseline", () => reads("quality-baseline.jsonl"), recorded],
			["exit", () => outcome(), "passed"],
		]);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality rejects an explicitly selected config that does not exist and asks to check the --config path",
	[qualityInstalled(), repositoryHas(CLEAN)],
	function* ({ outcome, spawns, stderr }) {
		yield* spawns("lint", "--config", "missing.ts");

		yield* withMatchers((expect) =>
			outcomes([
				["error", () => stderr(), expect.stringContaining("Check the --config path")],
				["exit", () => outcome(), "invalid"],
			]),
		);
	},
	CLI_TIMEOUT,
);
