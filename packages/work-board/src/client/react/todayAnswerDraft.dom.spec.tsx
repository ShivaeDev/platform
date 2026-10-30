import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { screenMedia } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { todayAnswerFixture, todayContextFixture } from "#test/todayRowsFixture.ts";

expectNoReactWarnings();

const READER = "Question for reader";
const DIALOG = "[role='dialog']";
const PHONE = 'nav[aria-label="Phone navigation"]';
const NARROW = screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]);

screenStory.it(
	"keeps what the reader typed in a Today answer after Escape closes it and it opens again",
	[routedScreen(todayAnswerFixture(), "/", { home: "home.md", writable: true })],
	function* ({ findElements, keyboard, roles }) {
		const answer = { name: `Answer ${READER}`, role: "button" };
		yield* eventually(() => expect(roles.text(answer)).toBe("Answer"));
		yield* roles.click(answer);
		yield* roles.enter({ name: "Your answer", role: "textbox" }, "Publish the guide");
		keyboard("Escape");
		yield* eventually(() => expect(findElements(DIALOG, document)).toEqual([]));
		yield* roles.click(answer);
		expect(roles.value({ name: "Your answer", role: "textbox" })).toBe("Publish the guide");
	},
);

for (const [title, label] of [
	[READER, "Your answer"],
	["Name the next release", "What should the release be called?"],
] as const) {
	screenStory.it(
		`shares one draft for "${title}" between Today and the item page, in both directions`,
		[routedScreen(todayAnswerFixture(), "/", { home: "home.md", writable: true })],
		function* ({ findElement, location, navigate, roles }) {
			const answer = { name: `Answer ${title}`, role: "button" };
			yield* eventually(() => expect(roles.text(answer)).toBe("Answer"));
			yield* roles.click(answer);
			yield* roles.enter({ name: label, role: "textbox" }, "Started on Today");
			const [item] = (findElement(`${DIALOG} a`, document)?.getAttribute("href") ?? "").split("#");
			yield* roles.click({ name: "Read the full question", role: "link" });
			yield* eventually(() => expect(location()?.pathname).toBe(item));
			const page = { name: "Your answer", role: "textbox" };
			yield* eventually(() => expect(roles.value(page)).toBe("Started on Today"));
			yield* roles.enter(page, "Finished on the item page");
			yield* Effect.promise(() => navigate("/"));
			yield* eventually(() => expect(roles.text(answer)).toBe("Answer"));
			yield* roles.click(answer);
			expect(roles.value({ name: label, role: "textbox" })).toBe("Finished on the item page");
		},
	);
}

screenStory.it(
	"puts focus in the text box when a Today answer opens, and on the first option when it offers options, past the question's context",
	[routedScreen(todayContextFixture(), "/", { home: "home.md", writable: true })],
	function* ({ keyboard, findElements, readFocus, roles }) {
		const text = { name: "Answer Keep the startup workaround?", role: "button" };
		yield* eventually(() => expect(roles.text(text)).toBe("Answer"));
		yield* roles.click(text);
		expect(roles.text({ name: "Options in the question (3)", role: "button" })).toContain("Options in the question");
		yield* eventually(() => expect(roles.accessible(readFocus() ?? document.body)).toEqual({ name: "Your answer", role: "textbox" }));
		keyboard("Escape");
		yield* eventually(() => expect(findElements(DIALOG, document)).toEqual([]));
		yield* roles.click({ name: "Answer Pick the launch day", role: "button" });
		expect(roles.text({ name: "Recommendation in the question", role: "button" })).toContain("Recommendation");
		yield* eventually(() => expect(roles.accessible(readFocus() ?? document.body)).toEqual({ name: "Monday Choose monday.", role: "button" }));
	},
);

screenStory.it(
	"answers from a bottom sheet on a phone, with a touch-sized Answer button and the phone navigation out of the way while typing",
	[NARROW, routedScreen(todayAnswerFixture(), "/", { home: "home.md", writable: true })],
	function* ({ control, findElement, findElements, keyboard, readResponses, roles }) {
		const answer = { name: `Answer ${READER}`, role: "button" };
		yield* eventually(() => expect(roles.text(answer)).toBe("Answer"));
		const actions = findElements("#needs-you li :is(button[aria-label^='Answer'], a[aria-label^='Open'])");
		expect(actions.length).toBeGreaterThan(0);
		expect(actions.filter((action) => !action.classList.contains("pointer-coarse:h-11"))).toEqual([]);
		expect(control(PHONE, HTMLElement).hidden).toBe(false);
		yield* roles.click(answer);
		yield* eventually(() => expect(findElement("[data-slot='sheet-content']", document)?.getAttribute("data-side")).toBe("bottom"));
		expect(findElement("[data-slot='popover-content']", document)).toBeNull();
		expect(roles.accessible(`${DIALOG}[data-slot='sheet-content']`)).toEqual({ name: `Answer ${READER}`, role: "dialog" });
		yield* eventually(() => expect(control(PHONE, HTMLElement).hidden).toBe(true));
		yield* roles.enter({ name: "Your answer", role: "textbox" }, "Publish the guide on Monday.");
		expect(findElement(`${DIALOG} button[type='submit']`, document)?.classList.contains("pointer-coarse:h-11")).toBe(true);
		keyboard("Escape");
		yield* eventually(() => expect(findElements(DIALOG, document)).toEqual([]));
		expect(control(PHONE, HTMLElement).hidden).toBe(false);
		yield* roles.click(answer);
		yield* roles.click({ name: "Record answer", role: "button" });
		yield* eventually(() => expect(roles.text({ name: "Needs you", role: "list" })).not.toContain(READER));
		const saved = yield* Effect.promise(() => readResponses("decision.reader", "direction"));
		expect(saved.responses.map((entry) => entry.body)).toEqual(["Publish the guide on Monday."]);
	},
);

screenStory.it(
	"records an option chosen on Today with one response body, as the item page writes it",
	[routedScreen(todayAnswerFixture(), "/", { home: "home.md", writable: true })],
	function* ({ readResponses, roles }) {
		yield* eventually(() => expect(roles.text({ name: "Answer Pick a venue for the launch", role: "button" })).toBe("Answer"));
		yield* roles.click({ name: "Answer Pick a venue for the launch", role: "button" });
		yield* roles.click({ name: "Hall Choose hall.", role: "button" });
		yield* eventually(() => expect(roles.text({ name: "Needs you", role: "list" })).not.toContain("Pick a venue for the launch"));
		const saved = yield* Effect.promise(() => readResponses("decision.venue", "direction"));
		const [body] = saved.responses.map((entry) => entry.body);
		expect(body?.match(/^# Recorded response$/gmu)).toEqual(["# Recorded response"]);
		expect(body).not.toContain("## Overall response");
	},
);

screenStory.it(
	"records the item page's note and reply kind with an option chosen on Today, and says so before the reader chooses",
	[routedScreen(todayAnswerFixture(), "/", { home: "home.md", writable: true })],
	function* ({ chooseOption, findElement, findElements, navigate, openDetails, readAttribute, readResponses, readText, roles }) {
		const venue = { name: "Answer Pick a venue for the launch", role: "button" };
		yield* eventually(() => expect(roles.text(venue)).toBe("Answer"));
		yield* Effect.promise(() => navigate("/_board/item/decision.venue/"));
		const optionNote = { name: "Add a note or answer in your own words (optional)", role: "textbox" };
		yield* eventually(() => expect(roles.value(optionNote)).toBe(""));
		yield* roles.enter(optionNote, "The hall has parking.");
		openDetails("[data-key='response-details']");
		yield* roles.enter({ name: "Anything else to add (optional)", role: "textbox" }, "Check the date with the team.");
		yield* Effect.promise(() => chooseOption(findElement("#response-form [role='combobox']"), "A question back (it keeps waiting for you)"));
		yield* Effect.promise(() => navigate("/"));
		yield* eventually(() => expect(roles.text(venue)).toBe("Answer"));
		yield* roles.click(venue);
		expect(readText(`${DIALOG} [data-hidden-draft]`, document)).toBe(
			"Also sends your note, your reply kind, a question back from the item page. Review it on the item page",
		);
		expect(readAttribute(`${DIALOG} [data-hidden-draft] a`, "href", document)).toBe("/_board/item/decision.venue/#answer-card-direction");
		yield* roles.click({ name: "Hall Choose hall.", role: "button" });
		yield* eventually(() => expect(findElements(DIALOG, document)).toEqual([]));
		const saved = yield* Effect.promise(() => readResponses("decision.venue", "direction"));
		expect(saved.responses.map((entry) => [entry.response.type, entry.response.answers])).toEqual([
			["clarify", [{ prompt: "venue", selected: ["hall"], text: "The hall has parking." }]],
		]);
		expect(saved.responses[0]?.body).toContain("## Overall response\n\nCheck the date with the team.");
	},
);

const PROMPT_TEXT_LIMIT = 8192;
const BODY_LIMIT = 32_768;
screenStory.it(
	"limits a Today answer to the length its response file accepts, shorter for a question's prompt than for a whole reply",
	[routedScreen(todayAnswerFixture(), "/", { home: "home.md", writable: true })],
	function* ({ findElements, keyboard, roles }) {
		for (const [title, label, limit] of [
			["Name the next release", "What should the release be called?", PROMPT_TEXT_LIMIT],
			[READER, "Your answer", BODY_LIMIT],
		] as const) {
			yield* eventually(() => expect(roles.text({ name: `Answer ${title}`, role: "button" })).toBe("Answer"));
			yield* roles.click({ name: `Answer ${title}`, role: "button" });
			const box = findElements(`${DIALOG} textarea`, document).find((element) => roles.accessible(element).name === label);
			expect(box?.getAttribute("maxlength")).toBe(String(limit));
			keyboard("Escape");
			yield* eventually(() => expect(findElements(DIALOG, document)).toEqual([]));
		}
	},
);

screenStory.it(
	"records the earlier answer the item page chose to replace, and names it on Today first",
	[routedScreen(todayAnswerFixture(), "/", { home: "home.md", writable: true })],
	function* ({ chooseOption, findElement, findElements, navigate, openDetails, readResponses, readText, roles }) {
		const reader = { name: `Answer ${READER}`, role: "button" };
		yield* eventually(() => expect(roles.text(reader)).toBe("Answer"));
		yield* Effect.promise(() => navigate("/_board/item/decision.reader/"));
		const body = { name: "Your answer", role: "textbox" };
		yield* eventually(() => expect(roles.value(body)).toBe(""));
		yield* roles.enter(body, "Ask me after the release.");
		openDetails("[data-key='response-details']");
		yield* Effect.promise(() => chooseOption(findElement("#response-form [role='combobox']"), "Not now (it keeps waiting for you)"));
		yield* roles.click({ name: "Record answer", role: "button" });
		yield* eventually(() => expect(readText("#response-status")).toContain("Answer saved"));
		const [earlier] = (yield* Effect.promise(() => readResponses("decision.reader", "direction"))).responses;
		function replacing() {
			return findElements("#response-form [role='combobox']").find(
				(element) => document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent === "Replace an earlier answer?",
			);
		}
		yield* eventually(() => expect(replacing()).toBeDefined());
		yield* Effect.promise(() => chooseOption(replacing(), "Yes, replace your answer"));
		yield* Effect.promise(() => navigate("/"));
		yield* eventually(() => expect(roles.text(reader)).toBe("Answer"));
		yield* roles.click(reader);
		expect(readText(`${DIALOG} [data-hidden-draft]`, document)).toBe(
			"Also sends the earlier answer it replaces from the item page. Review it on the item page",
		);
		yield* roles.enter(body, "Publish the guide on Monday.");
		yield* roles.click({ name: "Record answer", role: "button" });
		yield* eventually(() => expect(findElements(DIALOG, document)).toEqual([]));
		const saved = yield* Effect.promise(() => readResponses("decision.reader", "direction"));
		expect(saved.responses.map((entry) => [entry.body, entry.response.supersedes])).toEqual(
			expect.arrayContaining([["Publish the guide on Monday.", earlier?.id]]),
		);
	},
);
