import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { withMatchers } from "#testing/adapters/assertThat.ts";

repositoryStory.it(
	"quality reports a throwing Prisma config once under code/unused and finishes the other rules",
	[
		qualityInstalled(),
		repositoryHas(
			{ content: '{"name":"app","type":"module","devDependencies":{"prisma":"*"}}', path: "package.json" },
			{ content: 'throw new Error("DATABASE_URL is required"); export default {};', path: "prisma.config.ts" },
			{ content: "// TODO: finish this entry\nexport const value = 1;\n", path: "src/value.ts" },
		),
	],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* withMatchers((expect) =>
			outcomes([
				["gate", () => outcome(), "rejected"],
				["unused-code finding", () => stdout(), expect.stringContaining("error code/unused (1)")],
				["config error", () => stdout(), expect.stringContaining("DATABASE_URL is required")],
				["other rules", () => stdout(), expect.stringContaining("error comments/no-todo (1)")],
			]),
		);
	},
);
