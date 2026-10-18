import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, projectFiles, readerAt, responsesEnabled } from "#test/boardStory.ts";
import { formEvent } from "#test/formEvent.ts";
import { waitFor } from "#test/live.ts";
import { questionnaireSource } from "#test/questionnaire.ts";
import { anAnswerForm } from "#test/storyTraits.ts";

boardStory.it(
	"keeps authored markup outside answer controls and records one batch when every prompt has a choice or human text",
	[
		projectFiles(
			{
				"proposal.md": `${questionnaireSource}\n<form id="forged"><input name="author" value="forged"></form>\n<script>globalThis.forged = true</script>\n`,
			},
			"a project source awaits direction",
		),
		responsesEnabled(),
		readerAt("/_board/respond?item=investigation.choices&request=direction"),
		anAnswerForm(),
	],
	function* ({ page, reader }) {
		expect(page.document.querySelectorAll("fieldset[data-prompt]")).toHaveLength(2);
		expect(page.document.querySelectorAll("input:checked")).toHaveLength(0);
		expect(page.document.querySelector('[data-prompt="display"] .question-choice')?.textContent).toMatch(/^Latest reply/u);
		expect(page.document.querySelector(".answer-cards #forged")).toBeNull();
		expect(page.document.querySelector("article.doc strong")?.textContent).toBe("reasoning");
		yield* Effect.promise(() => waitFor(() => expect(page.mermaid.calls.length).toBeGreaterThan(0)));
		reader.text('[name="author"]', "maintainer");
		yield* formEvent(page, () => reader.choice("history"));
		yield* reader.preview();
		expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(false);
		reader.text('[data-prompt="checks"] textarea', "None of these; test keyboard use instead.");
		yield* reader.preview();
		expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(false);
		expect(page.document.getElementById("response-preview-content")?.textContent).toContain('"prompt": "checks"');
		yield* reader.submit("response-form");
		yield* Effect.promise(() =>
			waitFor(() => expect(page.document.getElementById("response-history")?.textContent).toContain("test keyboard use instead")),
		);
		expect(page.document.getElementById("response-history")?.textContent).toContain("Chose Full history");
		yield* reader.waitForResponseStatus("not acceptance");
	},
);

boardStory.it(
	"retains human text but clears selections when the template changes, exposing a recoverable earlier packet",
	[
		projectFiles(
			{
				"proposal.md": `${questionnaireSource}\n<form id="forged"><input name="author" value="forged"></form>\n<script>globalThis.forged = true</script>\n`,
			},
			"a project source awaits direction",
		),
		responsesEnabled(),
		readerAt("/_board/respond?item=investigation.choices&request=direction"),
		anAnswerForm(),
	],
	function* ({ page, reader, editFile }) {
		reader.text('[name="author"]', "maintainer");
		yield* formEvent(page, () => reader.choice("history"));
		reader.text('[data-prompt="display"] textarea', "Keep this rationale.");
		editFile("proposal.md", questionnaireSource.replace("Full history", "Changed meaning of the same option"));
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-status")?.textContent).toContain("Source changed")));
		expect(page.document.querySelectorAll("input:checked")).toHaveLength(0);
		expect(page.document.querySelector('[data-prompt="display"] textarea')).toHaveProperty("value", "Keep this rationale.");
		expect(page.document.getElementById("response-draft-recovery")?.textContent).toContain("history");
		expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(false);
		yield* reader.submit("response-form");
		expect(page.document.getElementById("response-status")?.textContent).toContain("Unanswered: “Which checks matter?”.");
	},
);
