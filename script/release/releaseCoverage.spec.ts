import { expect } from "vitest";
import { collectedBehindMain } from "#release/test-support/collectedBehindMain.ts";
import { repository } from "#release/test-support/repository.ts";

repository.it(
	"the publishing gate refuses changesets merged after the collected release and names their commit",
	[collectedBehindMain],
	function* ({ check }) {
		const answer = yield* check();

		expect(answer).toContain("Release leaves pending changesets outside its notes: later.md.");
		expect(answer).toMatch(/[a-f\d]+ Replace platform API/u);
		expect(answer).toContain("Let the release PR regenerate before merging or publishing.");
	},
);
