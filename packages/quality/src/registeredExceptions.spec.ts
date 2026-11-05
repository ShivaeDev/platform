import { expect } from "@effect/vitest";
import { CLI_TIMEOUT } from "@shivaedev/test-kits/quality/adapters/cli.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { biomeFormatted, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { trees } from "#test/trees.ts";

const EXCEPTIONS = {
	content:
		'export default { exceptions: [{ files: ["src/long.ts", "src/longer.ts"], reason: "Generated from the schema.", rules: ["structure/max-lines"] }], rules: { "structure/max-lines": { options: { source: 3 } } }, sources: ["src"] };\n',
	path: "quality.config.ts",
};
const LONG_FIXED = { content: "String(0);\n", path: "src/long.ts" };

repositoryStory.it(
	"quality lint passes when the config exceptions cover every finding and counts the registered findings",
	[qualityInstalled(), repositoryHas(...trees.dirty, EXCEPTIONS), biomeFormatted()],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes([
			["exit", () => outcome(), "passed"],
			["report", () => stdout(), expect.stringContaining("quality: passed. 3 source files checked; 2 registered violations not shown.")],
		]);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"once the author fixes a registered file, quality lint rejects its config exception as matching no violation",
	[qualityInstalled(), repositoryHas(...trees.dirty, EXCEPTIONS), biomeFormatted()],
	function* ({ runs, writes }) {
		expect((yield* runs("lint")).outcome).toBe("passed");

		yield* writes(LONG_FIXED);

		expect(yield* runs("lint")).toMatchObject({
			outcome: "rejected",
			stdout: expect.stringContaining("structure/max-lines src/long.ts matches no violation."),
		});
	},
	CLI_TIMEOUT,
);
