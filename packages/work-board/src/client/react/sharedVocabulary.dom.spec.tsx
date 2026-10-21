import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { sharedVocabularyFixture } from "#test/sharedVocabularyFixture.ts";

screenStory.it(
	"renders question scope and urgency with blocking asks before whenever asks",
	[routedScreen(sharedVocabularyFixture, "/")],
	function* ({ findElements, readText }) {
		yield* Effect.promise(() =>
			eventually(() =>
				expect(findElements("[data-attention-id]").map((entry) => entry.getAttribute("data-attention-id"))).toEqual(["question.z", "question.a"]),
			),
		);
		expect(findElements("[data-attention-id]").map((entry) => entry.getAttribute("data-attention-id"))).toEqual(["question.z", "question.a"]);
		expect(readText('[data-attention-id="question.z"]')).toContain("task · blocking");
		expect(readText('[data-attention-id="question.a"]')).toContain("area · whenever");
	},
);
screenStory.it(
	"renders the standing answer as a ruling on related work",
	[routedScreen(sharedVocabularyFixture, "/ready.md")],
	function* ({ findElement, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement('[aria-label="Ruling"]')).not.toBeNull()));
		expect(readText('[aria-label="Ruling"]')).toContain("Engine rulingUse the existing engine.");
	},
);
