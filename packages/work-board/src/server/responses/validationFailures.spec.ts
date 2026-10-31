import { expect } from "vitest";
import { aQuestionnaire, boardStory } from "#test/boardStory.ts";
import { TEXT_QUESTION } from "#test/coverageEdges.ts";
import { questionnaireAnswers, questionnaireSource } from "#test/questionnaire.ts";
import { questionRegistered } from "#test/questionRecordTraits.ts";

const [display, checks] = questionnaireAnswers;
const SELECTION_MODE =
	"conflict: The selected options do not match the question's selection mode. Select each option once and choose at most one for a single-choice question.";
const WITHOUT_PROMPTS = questionnaireSource.slice(0, questionnaireSource.indexOf("::::question"));

for (const { answer, refusal, reply } of [
	{
		answer: "answers its prompts in reverse order",
		refusal: "conflict: Submit one answer per question, in template order.",
		reply: { answers: [checks, display] },
	},
	{
		answer: "answers only the first prompt",
		refusal: "conflict: The answer packet does not match the reviewed questions. Review the current packet and answer each prompt.",
		reply: { answers: [display] },
	},
	{
		answer: "chooses an option the template lacks",
		refusal: "conflict: A selected option is not in the reviewed template. Review the current options and select again.",
		reply: { answers: [{ ...display, selected: ["absent"] }, checks] },
	},
	{
		answer: "chooses two options where one is allowed",
		refusal: SELECTION_MODE,
		reply: { answers: [{ ...display, selected: ["latest", "history"] }, checks] },
	},
	{ answer: "chooses the same option twice", refusal: SELECTION_MODE, reply: { answers: [display, { ...checks, selected: ["back", "back"] }] } },
	{
		answer: "leaves a prompt without a choice or text",
		refusal: "conflict: Answer every question with a selection or additional text, or use Clarify / Not now.",
		reply: { answers: [{ ...display, selected: [], text: "" }, checks] },
	},
	{
		answer: "has no prompt answers at all",
		refusal: "conflict: This question packet requires answers for all prompts. Answer every prompt or use Clarify / Not now.",
		reply: {},
	},
	{
		answer: "is a clarification whose texts are blank",
		refusal: "conflict: Clarify / Not now needs explanatory text.",
		reply: { answers: questionnaireAnswers.map((entry) => ({ ...entry, text: " " })), type: "clarify" as const },
	},
]) {
	boardStory.it(`a questionnaire reply that ${answer} is refused`, [aQuestionnaire(), questionRegistered()], function* ({ recordReply }) {
		expect(yield* recordReply({ body: "", id: "response.edge", ...reply })).toBe(refusal);
	});
}

boardStory.it(
	"an empty reply to a question without prompts is refused",
	[aQuestionnaire(WITHOUT_PROMPTS), questionRegistered()],
	function* ({ recordReply }) {
		expect(yield* recordReply({ body: "", id: "response.edge" })).toBe("conflict: A response needs text or answers to the question packet.");
	},
);

boardStory.it(
	"a reply whose recorded text would exceed 32768 characters with its question is refused",
	[aQuestionnaire(WITHOUT_PROMPTS + TEXT_QUESTION.replace("What should happen next?", "x".repeat(32_700))), questionRegistered()],
	function* ({ recordReply }) {
		expect(yield* recordReply({ answers: [{ prompt: "next", selected: [], text: "y".repeat(100) }], body: "", id: "response.edge" })).toBe(
			"conflict: The complete recorded response exceeds 32768 characters. Shorten the response or split the source request.",
		);
	},
);
