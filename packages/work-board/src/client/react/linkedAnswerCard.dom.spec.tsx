import { Effect } from "effect";
import { act } from "react";
import { afterEach, expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { revisionOf } from "#server/responses/records.ts";
import { answerCardFixture, decisionFile, decisionId, readyDecisionFixture } from "#test/answerCardFixture.ts";
import { responseCommands } from "#test/responseCommands.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
afterEach(() => {
	window.dispatchEvent(new Event("pagehide"));
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

for (const url of ["/guide.md", "/_board/item/task.guide/"]) {
	screenStory.it(
		`shows the decision's quiet answer card under the unblocked item's header at ${url}`,
		[routedScreen(readyDecisionFixture, url, { home: "home.md", writable: true })],
		function* ({ routed, answerPrompt, responseClick }) {
			const view = routed();
			const { register, record } = responseCommands(view.forms);

			yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("#response-form")).not.toBeNull()));
			const header = view.container.querySelector(".item-introduction");
			expect(header?.querySelector("h1")?.textContent).toBe("Publish the install guide");
			expect(header?.nextElementSibling?.classList.contains("answer-cards")).toBe(true);
			const card = view.container.querySelector(".response-panel");
			expect(card?.querySelector(".answer-reason strong")?.textContent).toBe("Reviewed PR is ready to merge.");
			expect(card?.querySelector(".answer-links a")?.textContent).toBe("Open PR #395");
			expect([...view.container.querySelectorAll(".question-choice strong")].map((label) => label.textContent)).toEqual([
				"Request changes",
				"Release",
			]);
			const more = card?.querySelector("details[data-key='response-details']");
			expect(more).toHaveProperty("open", false);
			expect(more?.querySelector("summary")?.textContent).toBe("More options");
			expect(more?.textContent).toContain("256 KiB");
			for (const selector of ['[name="author"]', '[name="type"]', "#response-preview", "#response-clear"]) {
				expect(card?.querySelector(selector)?.closest("details")).toBe(more);
			}
			expect([...view.container.querySelectorAll("textarea")].filter((field) => !field.closest("details"))).toHaveLength(1);
			expect(card?.querySelector("#response-submit")?.textContent).toBe("Record answer");
			expect(view.container.querySelector("article.doc")?.textContent).toContain("Keep the release instructions clear.");
			answerPrompt("fleet-action", "Please tighten the release instructions.");
			yield* Effect.promise(() => act(async () => responseClick("submit")));
			yield* Effect.promise(() => eventually(() => expect(card?.querySelector('[role="status"]')?.textContent).toContain("Saved:")));
			expect(register).toHaveBeenCalledTimes(1);
			expect(record).toHaveBeenCalledTimes(1);
			expect(register).toHaveBeenCalledWith({
				item: decisionId,
				request: "direction",
				revision: revisionOf(readyDecisionFixture[decisionFile] ?? ""),
			});
			expect(record).toHaveBeenCalledWith(
				expect.objectContaining({
					answers: [{ prompt: "fleet-action", selected: [], text: "Please tighten the release instructions." }],
					author: "maintainer",
				}),
			);
		},
	);
}

screenStory.it(
	"uses the decision's authored options on the task page and shows one read-only instruction",
	[routedScreen(answerCardFixture, "/guide.md")],
	function* ({ routed }) {
		const view = routed();

		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("#response-form")).not.toBeNull()));
		expect([...view.container.querySelectorAll(".question-choice")].map((button) => button.textContent)).toEqual([
			"Publish nowRecommendedShip the reviewed guide with this release.",
			"Wait for reviewKeep the work blocked until another review.",
		]);
		expect(view.container.querySelector("#response-status")?.textContent).toBe(
			"This Board is read-only. Start it with --responses to record answers.",
		);
		expect(view.container.querySelector("#response-submit")).toHaveProperty("disabled", true);
		expect(view.container.querySelectorAll('.response-panel [role="status"]')).toHaveLength(1);
	},
);

screenStory.it("omits a linked card after its request closes", [], function* ({ renderRouter }) {
	const files = { ...answerCardFixture, [decisionFile]: (answerCardFixture[decisionFile] ?? "").replace('"state":"open"', '"state":"closed"') };
	const view = yield* Effect.promise(() => renderRouter(files, "/guide.md", { home: "home.md" }));

	yield* Effect.promise(() =>
		eventually(() => expect(view.container.querySelector("article.doc")?.textContent).toContain("Keep the release instructions clear.")),
	);
	expect(view.container.querySelector(".answer-cards")).toBeNull();
});
