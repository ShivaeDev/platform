import { expect } from "vitest";
import { rawGet } from "#test/board.ts";
import { boardStory, projectFiles, readerAt, responsesEnabled } from "#test/boardStory.ts";
import { capturedQuestionnaire, questionnaireSource, scopedQuestionnaire } from "#test/questionnaire.ts";

boardStory.it(
	"opens an answer card with packet controls through the legacy response URL",
	[
		projectFiles({ "decision.md": questionnaireSource, "task.md": "# Affected work" }, "a project source awaits direction"),
		responsesEnabled(),
		readerAt("/_board/item/investigation.choices/"),
	],
	function* ({ board, page }) {
		expect(page.document.querySelectorAll("#answer-card-direction fieldset")).toHaveLength(2);
		expect(page.document.querySelectorAll("article.doc .questionnaire-question")).toHaveLength(0);
		expect(page.document.querySelector('#response-form input[type="radio"]')).not.toBeNull();
		expect(page.document.querySelector('#response-form input[type="checkbox"]')).not.toBeNull();
		const response = yield* rawGet(board, "/_board/respond?item=investigation.choices&request=direction");
		expect(response.status).toBe(302);
		expect(response.location).toBe("/_board/item/investigation.choices/#answer-card-direction");
	},
);

boardStory.it(
	"shows an answer card with recording disabled in read-only mode",
	[
		projectFiles({ "decision.md": questionnaireSource, "task.md": "# Affected work" }, "a project source awaits direction"),
		readerAt("/_board/item/investigation.choices/"),
	],
	({ page }) => {
		expect(page.document.querySelectorAll("#answer-card-direction fieldset")).toHaveLength(2);
		expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(true);
		expect(page.document.getElementById("response-status")?.textContent).toBe(
			"This Board is read-only. Start it with --responses to record answers.",
		);
	},
);

boardStory.it(
	"retains the readable packet when its request is closed",
	[
		projectFiles(
			{ "decision.md": questionnaireSource.replace("state: open", "state: closed"), "task.md": "# Affected work" },
			"a project source awaits direction",
		),
		responsesEnabled(),
		readerAt("/_board/item/investigation.choices/"),
	],
	({ page }) => {
		expect(page.document.querySelector("#answer-card-direction")).toBeNull();
		expect(page.document.querySelector(".questionnaire-answer")).toBeNull();
		expect(page.document.querySelectorAll(".questionnaire-option")).toHaveLength(4);
	},
);

for (const mode of ["managed", "registered", "needs-human"]) {
	let source = questionnaireSource;
	if (mode === "managed") {
		source = source.replace("kind: decision", "kind: decision\n    managed: true");
	}
	if (mode === "needs-human") {
		source = source.replace("kind: investigation", "kind: investigation\nstatus: needs-human");
	}

	boardStory.it(
		`links an open packet from Today straight to the response form (${mode})`,
		[
			readerAt("/"),
			projectFiles(
				{ "decision.md": source, ...(mode === "managed" ? {} : { "responses/question.md": capturedQuestionnaire(source) }) },
				"an open packet awaits a reply",
			),
			responsesEnabled(),
		],
		({ page }) => {
			const links = [...page.document.querySelectorAll("[data-attention-row] a[title]")];
			expect(links).toHaveLength(1);
			expect(links[0]?.getAttribute("href")).toBe("/_board/item/investigation.choices/#answer-card-direction");
		},
	);
}

for (const state of ["open", "closed"]) {
	boardStory.it(
		`keeps answer cards scoped when the second request is ${state}`,
		[
			projectFiles(
				{
					"decision.md": scopedQuestionnaire.replace("kind: review\n    state: open", `kind: review\n    state: ${state}`),
					"task.md": "# Affected work",
				},
				"a project source awaits direction",
			),
			responsesEnabled(),
			readerAt("/_board/item/investigation.choices/"),
		],
		({ page }) => {
			const first = page.document.querySelector("#answer-card-direction");
			expect(first?.querySelector('[data-prompt="display"]')).not.toBeNull();
			expect(first?.querySelector('[data-prompt="checks"]')).toBeNull();
			const second = page.document.querySelector("#answer-card-verification");
			if (state === "closed") {
				expect(second).toBeNull();
				expect(page.document.querySelectorAll(".questionnaire-question")).toHaveLength(1);
			} else {
				expect(first?.querySelector("fieldset")?.getAttribute("data-mode")).toBe("one");
				expect(second?.querySelector("fieldset")?.getAttribute("data-mode")).toBe("many");
				const ids = [...page.document.querySelectorAll(".answer-cards [id]")].map((element) => element.id);
				expect(new Set(ids).size).toBe(ids.length);
			}
		},
	);
}
