import { expect } from "vitest";
import { boardStory, projectFiles, readerAt } from "#test/boardStory.ts";
import { goalPageFixture } from "#test/goalPageFixture.ts";
import { pageTraffic } from "#test/pageTraffic.ts";

boardStory.it(
	"The goal chart's code loads only on a goal page that charts its criteria",
	[projectFiles(goalPageFixture()), pageTraffic(), readerAt("/")],
	function* ({ goalChartChunks, pageSettles, readerOpens }) {
		yield* pageSettles();
		expect(yield* goalChartChunks()).toBe("not loaded");

		yield* readerOpens("/goal.md");

		expect(yield* goalChartChunks()).toBe("loaded");
	},
);
