import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { consumerPatterns, outsideConsumerPatterns } from "#test/consumerPatterns.ts";
import { biomeFormatted, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { config } from "#test/tree.ts";

repositoryStory.it(
	"Quality lints a browser entry, router throwing adapters and a column helper bound to a feature without findings",
	[qualityInstalled(), repositoryHas(config('{ sources: ["src"] }'), ...consumerPatterns), biomeFormatted()],
	function* ({ outcome, runs, stderr, stdout }) {
		yield* runs("lint");

		yield* outcomes([
			["exit", () => outcome(), "passed"],
			["errors", () => stderr(), ""],
			["report", () => stdout(), "quality: passed. 5 source files checked.\n"],
		]);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"Quality reports runners outside entry modules, throwing helpers outside adapters and column-helper forwarding without type arguments",
	[qualityInstalled(), repositoryHas(config('{ sources: ["src"] }'), ...outsideConsumerPatterns), biomeFormatted()],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes([
			["exit", () => outcome(), "rejected"],
			["runner", () => stdout(), expect.stringContaining("src/client/work.tsx:5  Uses effect.Effect.runSync outside an entry point")],
			["redirect", () => stdout(), expect.stringContaining("Uses throwing helper call (goHome)")],
			["not found", () => stdout(), expect.stringContaining("Uses throwing helper call (missing)")],
			["forwarding", () => stdout(), expect.stringContaining("src/client/columns.ts:6  An exported alias, facade or forwarding function")],
		]);
	},
	CLI_TIMEOUT,
);
