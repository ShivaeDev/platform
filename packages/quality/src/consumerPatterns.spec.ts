import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { consumerPatterns, outsideConsumerPatterns } from "#test/outsideConsumerPatterns.ts";
import { biomeFormatted, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { FAST_RUN } from "#test/runs.ts";
import { withMatchers } from "#testing/adapters/assertThat.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";
import { config } from "#testing/adapters/tree.ts";

repositoryStory.it(
	"Quality lints a browser entry, router throwing adapters and a column helper bound to a feature without findings",
	[qualityInstalled(), repositoryHas(config('{ sources: ["src"] }'), ...consumerPatterns), biomeFormatted()],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes([
			["exit", () => outcome(), "passed"],
			["report", () => stdout(), `quality: passed. 5 source files checked.\n\n${FAST_RUN}\n`],
		]);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"Quality's full lint reports runners outside entry modules, throwing helpers outside adapters and column-helper forwarding without type arguments",
	[qualityInstalled(), repositoryHas(config('{ sources: ["src"] }'), ...outsideConsumerPatterns), biomeFormatted()],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint", "--full");

		yield* withMatchers((expect) =>
			outcomes([
				["exit", () => outcome(), "rejected"],
				["runner", () => stdout(), expect.stringContaining("src/client/work.tsx:5  Uses effect.Effect.runSync outside an entry point")],
				["redirect", () => stdout(), expect.stringContaining("Uses throwing helper call (goHome)")],
				["not found", () => stdout(), expect.stringContaining("Uses throwing helper call (missing)")],
				["forwarding", () => stdout(), expect.stringContaining("src/client/columns.ts:6  An exported alias, facade or forwarding function")],
			]),
		);
	},
	CLI_TIMEOUT,
);
