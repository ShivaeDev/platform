import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { DECISION_PATH, packetFiles, questionPath } from "#test/responsePacket.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

for (const path of [DECISION_PATH, questionPath]) {
	screenStory.it(
		`a response packet at ${path} reads as a document under its question's title, with its prose and sections and without its front matter`,
		[routedScreen(packetFiles, `/${path}`)],
		function* ({ documentSections, documentText, pageHeading }) {
			yield* outcomes([
				["heading", () => pageHeading(), "Choose a direction"],
				["prose", () => documentText(), expect.stringMatching(/^(?!.*"attention").*Read the evidence before choosing\./su)],
				["sections", () => documentSections(), ["Recommendation"]],
			]);
		},
	);
}
