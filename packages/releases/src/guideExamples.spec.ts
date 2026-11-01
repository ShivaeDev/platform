import { expect } from "@effect/vitest";
import { copiedGuideExample, guideExamples } from "#test/guideExamples.ts";
import { workspace } from "#test/workspace.ts";

for (const [index, text] of guideExamples.entries()) {
	workspace.it(
		`check accepts release guide example ${index + 1} copied verbatim into a workspace with its named packages`,
		[copiedGuideExample(index, text)],
		function* ({ check }) {
			expect(yield* check()).toBe("valid");
		},
	);
}
