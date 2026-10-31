import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { readingPage } from "#test/readingScreenTraits.tsx";
import { recordSourceFixture } from "#test/recordSourceFixture.ts";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();

for (const { file, source, explanation } of recordSourceFixture) {
	screenStory.it(
		`a ${file} record explains itself in the Source tab, which stays hidden until the reader opens it`,
		[readingPage({ [file]: source }, `/${file}`)],
		function* ({ openSourceTab, sourcePanel }) {
			expect(yield* sourcePanel()).toBe("hidden");

			yield* openSourceTab();

			expect(yield* sourcePanel()).toContain(explanation);
		},
	);
}
