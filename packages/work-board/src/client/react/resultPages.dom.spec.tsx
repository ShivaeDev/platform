import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	ambiguousQuestion,
	answeredResult,
	CHECKED_RESULT,
	LONE_RESULT,
	ORPHAN_RESULT,
	QUIET_RESULT,
	QUIET_TASK,
	REVIEW_TASK,
	relatedProblems,
	reviewResult,
	UNCHECKED_TASK,
	unrelatedProblems,
} from "#test/resultReview.ts";
import { failingRead } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen, routedScreen } from "#test/screenTraits.ts";
import { screenFiles, screenRoute } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

const ITEM = "/_board/item/result.keyboard/";
// The workspace's first file opens as its home board, so a note keeps each result on its ordinary item page.
const HOME = { "README.md": "# Workspace\n" };
const result = { ...HOME, "items/result.md": reviewResult(), "items/task.md": REVIEW_TASK };
const NO_FEEDBACK = "No feedback yet.";

screenStory.it(
	"puts the review request, the checks and a no-feedback note above the report under the report's one heading, with no separate review action",
	[routedScreen(result, ITEM)],
	function* ({ mainHeading, pageActions, resultNote, resultParts }) {
		yield* outcomes([
			["the actions", () => pageActions(), expect.not.arrayContaining([expect.objectContaining({ name: "Review returned result" })])],
			["the heading", () => mainHeading(), "First report"],
			["the note", () => resultNote(), NO_FEEDBACK],
			["the parts", () => resultParts(), ["review request", "checks", "note", "report"]],
		]);
	},
);

screenStory.it(
	"names the linked work with its title and status and offers a follow-up handoff for it",
	[routedScreen(result, ITEM)],
	function* ({ resultLinkedWork }) {
		expect(yield* resultLinkedWork()).toEqual([
			{
				followUp: ["Prepare follow-up handoff for Keyboard work", "/_board/handoff?item=work.keyboard"],
				link: "/_board/item/work.keyboard/",
				name: "Keyboard work",
				status: "Ready",
			},
		]);
	},
);

for (const { files, linked, note, parts, story, url } of [
	{
		files: { "items/result.md": QUIET_RESULT, "items/task.md": QUIET_TASK },
		linked: [expect.objectContaining({ name: "Quiet work", status: "Done" })],
		note: "No review requested, no checks listed and no feedback yet.",
		parts: ["note", "report"],
		story: "no review, no checks and no feedback",
		url: "/_board/item/result.quiet/",
	},
	{
		files: { "items/result.md": reviewResult(), "items/task.md": UNCHECKED_TASK },
		linked: [expect.objectContaining({ name: "Keyboard work" })],
		note: "No checks listed and no feedback yet.",
		parts: ["review request", "note", "report"],
		story: "a review request without checks",
		url: ITEM,
	},
	{
		files: { "items/result.md": CHECKED_RESULT, "items/task.md": REVIEW_TASK },
		linked: [expect.objectContaining({ name: "Keyboard work" })],
		note: "No review requested and no feedback yet.",
		parts: ["checks", "note", "report"],
		story: "checks without a review request",
		url: "/_board/item/result.checked/",
	},
	{
		files: { "items/result.md": LONE_RESULT },
		linked: "none" as const,
		note: "No review requested, no checks listed and no feedback yet.",
		parts: ["note", "report"],
		story: "no linked work",
		url: "/_board/item/result.alone/",
	},
]) {
	screenStory.it(
		`sums up a result with ${story} in one line before the report`,
		[routedScreen({ ...HOME, ...files }, url)],
		function* ({ resultLinkedWork, resultNote, resultParts }) {
			yield* outcomes([
				["the linked work", () => resultLinkedWork(), linked],
				["the note", () => resultNote(), note],
				["the parts", () => resultParts(), parts],
			]);
		},
	);
}

screenStory.it(
	"names linked work that can't be read by its ID, offers no follow-up for it and says its checks can't be read",
	[routedScreen({ ...HOME, "items/result.md": ORPHAN_RESULT }, "/_board/item/result.orphan/")],
	function* ({ resultChecks, resultLinkedWork }) {
		yield* outcomes([
			[
				"the checks",
				() => resultChecks(),
				[expect.objectContaining({ item: "work.missing", link: "work.missing", text: expect.stringContaining("This item can't be read") })],
			],
			[
				"the linked work",
				() => resultLinkedWork(),
				[{ followUp: "none", link: "none", name: "Forwork.missing (unresolved, ambiguous, or unavailable)", status: "none" }],
			],
		]);
	},
);

screenStory.it(
	"lists each linked check in a table, naming missing evidence and unrecorded details instead of leaving them blank",
	[routedScreen(result, ITEM)],
	function* ({ resultChecks }) {
		expect(yield* resultChecks()).toEqual([
			{
				columns: ["Check", "Evidence", "Outcome", "Method", "Revision checked", "Observed"],
				item: "Keyboard work",
				link: "Keyboard work",
				revision: "Git revision 0123456789012345678901234567890123456789",
				rows: [
					[
						"Escape restores focus",
						"../evidence/focus.mdFile not found",
						"Focus restored in the recorded check",
						"Actual keyboard check",
						"012345678901",
						"Not recorded",
					],
					["Narrow layout stays readable", "No evidence recorded"],
				],
				status: "Ready",
				text: expect.any(String),
			},
		]);
	},
);

screenStory.it(
	"dates feedback written for an earlier report by when it was reviewed instead of by its hash",
	[routedScreen({ ...HOME, ...answeredResult(true) }, ITEM)],
	function* ({ resultFeedback }) {
		expect(yield* resultFeedback()).toEqual([
			{
				author: "first-reader",
				hash: expect.stringMatching(/^[a-f\d]{64}$/u),
				reviewed: "Written for an earlier or moved version of items/result.md, as it was {time}. It doesn't apply to this version automatically.",
				when: "1970-01-01T00:00:01.000Z",
			},
		]);
	},
);

screenStory.it(
	"lists feedback on the shown report newest first above the report, dated when the report was received, with the full hash to copy",
	[routedScreen({ ...HOME, ...answeredResult() }, ITEM)],
	function* ({ pageModified, resultFeedback, resultParts }) {
		const received = yield* pageModified();
		const onThisVersion = {
			hash: expect.stringMatching(/^[a-f\d]{64}$/u),
			reviewed: "Written for the version of items/result.md shown here, received {time}.",
			when: received,
		};

		yield* outcomes([
			[
				"the feedback",
				() => resultFeedback(),
				[
					{ ...onThisVersion, author: "second-reader" },
					{ ...onThisVersion, author: "first-reader" },
				],
			],
			["the parts", () => resultParts(), ["review request", "checks", "feedback", "report"]],
		]);
	},
);

screenStory.it(
	"names each feedback file that can't be read, says why, links to System's source problems and drops the no-feedback note",
	[routedScreen({ ...result, ...relatedProblems(), "responses/broken.md": "---\nresponse: [unfinished\n" }, ITEM)],
	function* ({ feedbackProblems, resultNote }) {
		yield* outcomes([
			["the note", () => resultNote(), "none"],
			[
				"the problems",
				() => feedbackProblems(),
				{
					alert: expect.stringContaining("Some feedback couldn't be read"),
					files: [
						{ href: "/responses/broken.md", text: expect.stringMatching(/^responses\/broken\.md: \S/u) },
						{ href: "/responses/no-record.md", text: "responses/no-record.md: It's marked as a response but has no ID or response record." },
						{
							href: "/responses/question.edited.md",
							text: "responses/question.edited.md: It's marked as a question but its record doesn't match its text.",
						},
					],
					sourceProblems: [["See source problems in System", "/_board/system#source-problems"]],
				},
			],
		]);
	},
);

screenStory.it(
	"names both copies of a question whose identity is ambiguous and shows no feedback for it",
	[routedScreen({ ...HOME, ...ambiguousQuestion() }, ITEM)],
	function* ({ feedbackProblems, resultFeedback }) {
		const ambiguous = "The registered question identity is ambiguous; response history is unknown.";

		yield* outcomes([
			["the feedback", () => resultFeedback(), []],
			[
				"the problems",
				() => feedbackProblems(),
				expect.objectContaining({
					files: [
						{ href: expect.stringMatching(/^\/questions\/copy-of-question\.[a-f\d]{64}\.md$/u), text: expect.stringContaining(`: ${ambiguous}`) },
						{ href: expect.stringMatching(/^\/responses\/question\.[a-f\d]{64}\.md$/u), text: expect.stringContaining(`: ${ambiguous}`) },
					],
				}),
			],
		]);
	},
);

screenStory.it(
	"keeps showing feedback when only files about other work are broken, leaving them to System",
	[routedScreen({ ...HOME, ...answeredResult(), ...unrelatedProblems() }, ITEM)],
	function* ({ feedbackProblems, resultFeedback }) {
		yield* outcomes([
			[
				"the authors",
				() => resultFeedback(),
				[expect.objectContaining({ author: "second-reader" }), expect.objectContaining({ author: "first-reader" })],
			],
			["the problems", () => feedbackProblems(), "none"],
		]);
	},
);

screenStory.it(
	"says in plain words that checks and feedback can't be shown when their read fails, and still shows the report",
	[screenFiles(result), failingRead(ITEM), screenRoute("/items/result.md"), openScreen()],
	function* ({ reportText, resultFeedback, resultUnavailable }) {
		yield* outcomes([
			["the feedback", () => resultFeedback(), []],
			["the notice", () => resultUnavailable(), "Checks and feedback can't be shown. Reload the page to try again."],
			["the report", () => reportText(), expect.stringContaining("Narrow-screen evidence is not recorded.")],
		]);
	},
);
