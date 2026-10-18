import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { answerCardFixture, decisionFile, decisionId, readyDecisionFixture } from "#test/answerCardFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

for (const url of ["/guide.md", "/_board/item/task.guide/"]) {
	screenStory.it(
		`shows the decision's quiet answer card under the unblocked item's header at ${url}`,
		[routedScreen(readyDecisionFixture, url, { home: "home.md", writable: true })],
		function* ({ readResponses, answerPrompt, responseClick, findElement, readText, findElements }) {
			yield* Effect.promise(() => eventually(() => expect(findElement("#response-form")).not.toBeNull()));
			const header = findElement(".item-introduction");
			expect(readText("h1", header)).toBe("Publish the install guide");
			expect(header?.nextElementSibling?.classList.contains("answer-cards")).toBe(true);
			const card = findElement(".response-panel");
			expect(readText(".answer-reason strong", card)).toBe("Reviewed PR is ready to merge.");
			expect(readText(".answer-links a", card)).toBe("Open PR #395");
			expect([...findElements(".question-choice strong")].map((label) => label.textContent)).toEqual(["Request changes", "Stop and hand back"]);
			const more = findElement("details[data-key='response-details']", card);
			expect(more).toHaveProperty("open", false);
			expect(readText("summary", more)).toBe("More options");
			expect(more?.textContent).toContain("256 KiB");
			for (const selector of ['[name="author"]', '[name="type"]', "#response-preview", "#response-clear"]) {
				expect(findElement(selector, card)?.closest("details")).toBe(more);
			}
			expect([...findElements("textarea")].filter((field) => !field.closest("details"))).toHaveLength(1);
			expect(readText("#response-submit", card)).toBe("Record answer");
			expect(readText("article.doc")).toContain("Keep the release instructions clear.");
			answerPrompt("fleet-action", "Please tighten the release instructions.");
			yield* Effect.promise(async () => responseClick("submit"));
			yield* Effect.promise(() =>
				eventually(() => expect(readText("[data-answered]")).toBe("You answered. Fleet is unavailable, so it picks this up once it runs again.")),
			);
			const saved = yield* Effect.promise(() => readResponses(decisionId, "direction"));
			expect(saved.responses).toHaveLength(1);
			expect(saved.responses[0]?.response).toMatchObject({
				answers: [{ prompt: "fleet-action", selected: [], text: "Please tighten the release instructions." }],
				author: "maintainer",
			});
		},
	);
}

screenStory.it(
	"uses the decision's authored options on the task page and shows one read-only instruction",
	[routedScreen(answerCardFixture, "/guide.md")],
	function* ({ findElement, findElements, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#response-form")).not.toBeNull()));
		expect([...findElements(".question-choice")].map((button) => button.textContent)).toEqual([
			"Publish nowRecommendedShip the reviewed guide with this release.",
			"Wait for reviewKeep the work blocked until another review.",
		]);
		expect(readText("#response-status")).toBe("This Board is read-only. Start it with --responses to record answers.");
		expect(findElement("#response-submit")).toHaveProperty("disabled", true);
		expect(findElements('.response-panel [role="status"]')).toHaveLength(1);
	},
);

const files = { ...answerCardFixture, [decisionFile]: (answerCardFixture[decisionFile] ?? "").replace('"state":"open"', '"state":"closed"') };
screenStory.it(
	"omits a linked card after its request closes",
	[routedScreen(files, "/guide.md", { home: "home.md" })],
	function* ({ readText, findElement }) {
		yield* Effect.promise(() => eventually(() => expect(readText("article.doc")).toContain("Keep the release instructions clear.")));
		expect(findElement(".answer-cards")).toBeNull();
	},
);
