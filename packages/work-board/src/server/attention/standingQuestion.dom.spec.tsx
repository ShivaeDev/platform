import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { STANDING_QUESTION_ID, standingQuestionFixture } from "#test/standingQuestionFixture.ts";

expectNoReactWarnings();

screenStory.it(
	"shows the standing answer's choice and note and leaves Today waiting on the agent",
	[routedScreen(standingQuestionFixture(), `/_board/item/${STANDING_QUESTION_ID}/`, { home: "home.md", writable: true })],
	function* ({ answerPrompt, click, findElement, navigate, readAttribute, readText, responseClick }) {
		yield* eventually(() => expect(findElement("#response-form")).not.toBeNull());
		click("[data-choice='reviewed']");
		answerPrompt("release-policy", "Include the release notes.");
		responseClick("submit");
		yield* eventually(() => expect(readText(".response-panel")).toContain("Chose After review"));
		expect(readText(".response-panel")).toContain("Include the release notes.");
		yield* Effect.promise(() => navigate("/"));
		yield* eventually(() => expect(findElement("[data-answered-id='decision.release-policy']")).not.toBeNull());
		expect(findElement("ul[aria-label='Needs you']")).toBeNull();
		expect(readText("#needs-you")).toContain("Nothing needs you");
		expect(readAttribute("[data-answered-id='decision.release-policy'] p", "title")).toBe(
			"When should releases ship? · You chose After review · Waiting on the agent.",
		);
	},
);
