import { expect } from "vitest";
import { indexedFiles, indexStory } from "#test/indexStory.ts";
import { reviewedDecisionId, reviewedWorkFixture } from "#test/reviewedWorkFixture.ts";
import { searchMatch } from "./match.ts";

const files = reviewedWorkFixture();

indexStory.it(
	"names a Fleet decision in search after the work it unblocks and follows that work's rename",
	[indexedFiles(files)],
	function* ({ readIndex, invalidate, writeFile }) {
		function decisionTitle(index: Parameters<typeof searchMatch>[0], query: string) {
			return searchMatch(index, query).results.find((entry) => entry.id === reviewedDecisionId)?.title;
		}
		expect(decisionTitle((yield* readIndex()).entries, "records: flaky upload")).toBe("Fleet decision: Fix the flaky upload test");
		writeFile("tasks/upload.md", (files["tasks/upload.md"] ?? "").replace("# Fix the flaky upload test", "# Fix the upload race"));
		yield* invalidate(["tasks/upload.md"]);
		expect(decisionTitle((yield* readIndex()).entries, "records: upload race")).toBe("Fleet decision: Fix the upload race");
	},
);
