import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { todayAnswerFixture, todayRowsFixture } from "#test/todayRowsFixture.ts";

expectNoReactWarnings();

const IDS = /question\.storage|decision\.reader|task\.person|task\.ship|docs\.policy/u;
const ANSWERABLE = ["Where should the project documents live?", "Question for reader", "Ship the upload fix"];
const STORAGE = "Where should the project documents live?";
const TWO_HOURS = 2 * 60 * 60 * 1000;

screenStory.it(
	"a Needs you row leaves the item's id to its item page",
	[routedScreen(todayRowsFixture(), "/", { home: "home.md" })],
	function* ({ needsYouRows }) {
		const rows = yield* needsYouRows();
		expect(rows.filter((row) => IDS.test(`${row.title} ${row.detail}`))).toEqual([]);
	},
);

screenStory.it(
	"Needs you gives Fleet decisions and a person's notes as plain sentences",
	[routedScreen(todayRowsFixture(), "/", { home: "home.md" })],
	function* ({ needsYouRows }) {
		expect((yield* needsYouRows()).map((row) => row.detail)).toEqual(
			expect.arrayContaining([
				"task · whenever · Fleet asks: do you want changes before merging?",
				"Every export is supported API.",
				"Read the evidence",
			]),
		);
	},
);

screenStory.it(
	"each Needs you row offers one action, Answer for a question and Open for anything else, and its age adds no Tab stop",
	[
		routedScreen(todayRowsFixture(), "/", {
			home: "home.md",
			modified: new Map(Object.keys(todayRowsFixture()).map((path) => [path, Effect.runSync(Clock.currentTimeMillis) - TWO_HOURS])),
		}),
	],
	function* ({ needsYouRows }) {
		expect(yield* needsYouRows()).toEqual(
			expect.arrayContaining(
				[
					...ANSWERABLE,
					"Human action",
					"Is every module supported API?",
					"Plan the next release",
					"Which checks should block a release?",
					"Which mirror should serve downloads?",
				].map((title) => {
					const action = ANSWERABLE.includes(title) ? { name: `Answer ${title}`, role: "button" } : { name: `Open ${title}`, role: "link" };
					return expect.objectContaining({ actions: [action], age: "2h ago", tabStops: [title, action.name], title });
				}),
			),
		);
	},
);

screenStory.it(
	"the Today answer offers the question's options and links to the full question on its item page",
	[routedScreen(todayRowsFixture(), "/", { home: "home.md" })],
	function* ({ answerOnToday, location, roles, todayAnswerContent }) {
		yield* answerOnToday(STORAGE);
		expect(yield* todayAnswerContent()).toEqual(expect.stringMatching(/Keep local files · Recommended.*Use a database/su));

		yield* roles.click({ name: "Read the full question", role: "link" });

		expect((yield* location())?.pathname).toBe("/_board/item/question.storage/");
	},
);

screenStory.it(
	"a text answer recorded on Today for a request without options moves the question to Answered",
	[routedScreen(todayAnswerFixture(), "/", { home: "home.md", writable: true })],
	function* ({ answerOnToday, answeredOnToday, needsYou, recordOnToday, recordedAnswerTexts, writeOnToday }) {
		yield* answerOnToday("Question for reader");
		yield* writeOnToday("Publish the guide on Monday.");

		yield* recordOnToday();

		yield* outcomes({
			answered: [answeredOnToday("decision.reader"), expect.stringContaining("You answered")],
			"Needs you": [needsYou(), expect.not.arrayContaining(["Question for reader"])],
			recorded: [recordedAnswerTexts("decision.reader", "direction"), ["Publish the guide on Monday."]],
		});
	},
);

screenStory.it(
	"a Today answer cannot be recorded while its author name is empty",
	[routedScreen(todayAnswerFixture(), "/", { home: "home.md", writable: true })],
	function* ({ answerOnToday, openDetails, roles, todayAnswerRecordable, writeOnToday }) {
		yield* answerOnToday("Name the next release");
		yield* writeOnToday("Harbor", "What should the release be called?");
		yield* openDetails("[role='dialog'] details");
		yield* roles.enter({ name: "Answer as", role: "textbox" }, "");
		expect(yield* todayAnswerRecordable()).toBe("disabled");

		yield* roles.enter({ name: "Answer as", role: "textbox" }, "Casey");

		expect(yield* todayAnswerRecordable()).toBe("enabled");
	},
);

screenStory.it(
	"a typed answer recorded on Today is saved under its question with the author the reader named",
	[routedScreen(todayAnswerFixture(), "/", { home: "home.md", writable: true })],
	function* ({ answerOnToday, needsYou, openDetails, recordOnToday, recordedPacketAnswers, recordedPacketAuthors, roles, writeOnToday }) {
		yield* answerOnToday("Name the next release");
		yield* writeOnToday("Harbor", "What should the release be called?");
		yield* openDetails("[role='dialog'] details");
		yield* roles.enter({ name: "Answer as", role: "textbox" }, "Casey");

		yield* recordOnToday();

		yield* outcomes({
			answers: [recordedPacketAnswers("decision.name", "direction"), [[{ prompt: "name", selected: [], text: "Harbor" }]]],
			authors: [recordedPacketAuthors("decision.name", "direction"), ["Casey"]],
			"Needs you": [needsYou(), expect.not.arrayContaining(["Name the next release"])],
		});
	},
);

screenStory.it(
	"a Today answer to a question that changed after it opened is rejected with the reason",
	[routedScreen(todayAnswerFixture(), "/", { home: "home.md", writable: true })],
	function* ({ answerOnToday, editFile, recordOnToday, todayAnswerContent, writeOnToday }) {
		yield* answerOnToday("Name the next release");
		yield* writeOnToday("Harbor", "What should the release be called?");
		yield* editFile("decisions/name.md", `${todayAnswerFixture()["decisions/name.md"]}\nThe release ships next week.\n`);

		yield* recordOnToday();

		expect(yield* todayAnswerContent()).toEqual(expect.stringMatching(/Rejected: .*Source changed since review/su));
	},
);

screenStory.it(
	"choosing an option on Today records it and takes the question off Needs you",
	[routedScreen(todayAnswerFixture(), "/", { home: "home.md", writable: true })],
	function* ({ answerOnToday, chooseOnToday, needsYou, recordedPacketAnswers }) {
		yield* answerOnToday("Pick a venue for the launch");
		expect(yield* needsYou()).toEqual(expect.arrayContaining(["Pick a venue for the launch"]));

		yield* chooseOnToday("Hall Choose hall.");

		yield* outcomes({
			"Needs you": [needsYou(), expect.not.arrayContaining(["Pick a venue for the launch"])],
			recorded: [recordedPacketAnswers("decision.venue", "direction"), [[{ prompt: "venue", selected: ["hall"], text: "" }]]],
		});
	},
);

for (const title of [STORAGE, "Question for reader"]) {
	screenStory.it(
		`on a read-only Board the Today answer to ${title} says answering is turned off and offers only the full question`,
		[routedScreen(todayRowsFixture(), "/", { home: "home.md" })],
		function* ({ answerOnToday, todayAnswerContent, todayAnswerControls }) {
			yield* answerOnToday(title);

			yield* outcomes({
				controls: [todayAnswerControls(), [{ name: "Read the full question", role: "link" }]],
				"no CLI flag": [todayAnswerContent(), expect.not.stringContaining("--responses")],
				says: [todayAnswerContent(), expect.stringContaining("Answering is turned off on this Board.")],
			});
		},
	);
}

screenStory.it(
	"a read-only Board's Today answer still shows the question's options",
	[routedScreen(todayRowsFixture(), "/", { home: "home.md" })],
	function* ({ answerOnToday, todayAnswerContent }) {
		yield* answerOnToday(STORAGE);

		expect(yield* todayAnswerContent()).toEqual(expect.stringContaining("Keep local files · Recommended"));
	},
);
