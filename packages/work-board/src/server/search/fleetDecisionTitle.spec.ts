import { expect } from "vitest";
import { indexedFiles, indexStory } from "#test/indexStory.ts";
import { reviewedDecisionId, reviewedWorkFixture } from "#test/reviewedWorkFixture.ts";

const files = reviewedWorkFixture();

indexStory.it(
	"search names a Fleet decision after the work it unblocks and follows that work's rename",
	[indexedFiles(files)],
	function* ({ editorWrites, searchTitle, watcherReports }) {
		expect(yield* searchTitle("records: flaky upload", reviewedDecisionId)).toBe("Fleet decision: Fix the flaky upload test");

		yield* editorWrites("tasks/upload.md", (files["tasks/upload.md"] ?? "").replace("# Fix the flaky upload test", "# Fix the upload race"));
		yield* watcherReports("tasks/upload.md");

		expect(yield* searchTitle("records: upload race", reviewedDecisionId)).toBe("Fleet decision: Fix the upload race");
	},
);
