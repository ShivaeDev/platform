import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { decisionId, readyDecisionFixture } from "#test/answerCardFixture.ts";
import { ANSWERED_TASK, answeredDecisionFixture, appliedReceipt, guideFleet } from "#test/answeredDecisionFixture.ts";
import { screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { screenFleet } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();
const url = `/_board/item/${decisionId}/`;
const ANSWERED = "[aria-label='Answered']";
const NEXT_PASS = "You answered: Request changes. Fleet picks this up on its next pass.";
const FLEET_DOWN = "You answered: Request changes. Fleet isn't running. It picks this up when it starts again.";
const OPEN_ASK = {
	"ask.md": `---\n${JSON.stringify({
		attention: [
			{ id: "scope", kind: "decision", reason: "Confirm the guide scope", "response_from": ["maintainer"], state: "open", unblocks: ["task.guide"] },
		],
		id: "decision.scope",
		kind: "decision",
	})}\n---\n# Scope for the install guide\n`,
};

screenStory.it(
	"moves an answered Fleet decision out of Needs you until Fleet's receipt settles its week-old answer",
	[screenFleet(guideFleet), routedScreen(answeredDecisionFixture(), "/", { home: "home.md" })],
	function* ({ editFile, findElement, findElements, readText, refreshInbox }) {
		yield* Effect.promise(() => eventually(() => expect(findElement(`ul${ANSWERED}`)).not.toBeNull()));
		expect([...findElements(`ul${ANSWERED} > li p`)].map((row) => row.getAttribute("title"))).toEqual([NEXT_PASS]);
		expect(readText(`ul${ANSWERED} > li a`)).toBe("Do you want changes before merging?");
		expect(findElement(`ul${ANSWERED} [data-status-token]`)).toBeNull();
		expect(findElement("ul[aria-label='Needs you']")).toBeNull();
		expect(readText("#needs-you")).toContain("Nothing needs you");
		expect(readText(".today-strip")).toMatch(/^0 need you/u);
		editFile("guide.md", ANSWERED_TASK.replace("status: needs-human", "status: active"));
		const [[receipt, content] = []] = Object.entries(appliedReceipt());
		editFile(receipt ?? "", content ?? "");
		yield* Effect.promise(refreshInbox);
		yield* Effect.promise(() => eventually(() => expect(findElement("#answered")).toBeNull()));
		expect(findElement("ul[aria-label='Needs you']")).toBeNull();
	},
);

screenStory.it(
	"tells Today that an answer waits for Fleet to run again while Fleet is unavailable",
	[routedScreen(answeredDecisionFixture(), "/", { home: "home.md" })],
	function* ({ findElement, findElements }) {
		yield* Effect.promise(() => eventually(() => expect(findElement(`ul${ANSWERED}`)).not.toBeNull()));
		expect([...findElements(`ul${ANSWERED} > li p`)].map((row) => row.getAttribute("title"))).toEqual([FLEET_DOWN]);
		expect(findElement("ul[aria-label='Needs you']")).toBeNull();
	},
);

screenStory.it(
	"names the agent that answered instead of the reader",
	[screenFleet(guideFleet), routedScreen(answeredDecisionFixture("orchestrator"), "/", { home: "home.md" })],
	function* ({ findElement, findElements }) {
		yield* Effect.promise(() => eventually(() => expect(findElement(`ul${ANSWERED}`)).not.toBeNull()));
		expect([...findElements(`ul${ANSWERED} > li p`)].map((row) => row.getAttribute("title"))).toEqual([
			"Answered by orchestrator: Request changes. Fleet picks this up on its next pass.",
		]);
	},
);

for (const [fleet, copy] of [
	[true, NEXT_PASS],
	[false, FLEET_DOWN],
] as const) {
	screenStory.it(
		`queues the answered Now card for Fleet (Fleet ready=${fleet})`,
		[...(fleet ? [screenFleet(guideFleet)] : []), routedScreen(answeredDecisionFixture(), "/_board/work", { home: "home.md" })],
		function* ({ findElement, findElements, readAttribute, readText }) {
			const card = "[aria-label='Queued'] [data-item='task.guide']";
			yield* Effect.promise(() =>
				eventually(() => {
					expect(findElement(card)).not.toBeNull();
					expect([...findElements("[role='status']")].map((status) => status.textContent)).not.toContainEqual(
						expect.stringContaining("Fleet data has not loaded."),
					);
				}),
			);
			expect(findElement("[aria-label='Waiting on a person'] [data-item='task.guide']")).toBeNull();
			expect(readAttribute(`${card} [data-status-token]`, "data-status-token")).toBe("waiting-on-agents");
			expect(readText(`${card} [data-status-token]`)).toBe("Waiting on agents");
			expect(readText(`${card} .work-answer`)).toBe(copy);
			expect(readText(`${card} .work-owner`)).toBe("Waiting for Fleet");
		},
	);
}

screenStory.it(
	"keeps an answered Now card waiting on you while another ask on it is open",
	[screenFleet(guideFleet), routedScreen({ ...answeredDecisionFixture(), ...OPEN_ASK }, "/_board/work", { home: "home.md" })],
	function* ({ findElement, readAttribute }) {
		const card = "[aria-label='Waiting on a person'] [data-item='task.guide']";
		yield* Effect.promise(() => eventually(() => expect(findElement(card)).not.toBeNull()));
		expect(readAttribute(`${card} [data-status-token]`, "data-status-token")).toBe("needs-you");
		expect(findElement(`${card} .work-answer`)).toBeNull();
	},
);

screenStory.it(
	"moves a decision answered from the Today popover to Answered, keeps focus on its row and says when Fleet applies it",
	[
		screenWorkspace("answered-today"),
		screenFleet(guideFleet),
		routedScreen({ ...readyDecisionFixture, "guide.md": ANSWERED_TASK }, "/", { home: "home.md", writable: true }),
	],
	function* ({ activate, click, editFile, findElement, readAttribute, readFocus, readResponses, refreshInbox }) {
		const ask = "[data-attention-id='task.guide']";
		yield* Effect.promise(() => eventually(() => expect(findElement(`${ask} button[aria-haspopup='dialog']`)).not.toBeNull()));
		click(`${ask} button[aria-haspopup='dialog']`);
		yield* Effect.promise(() =>
			eventually(() => expect(findElement("[aria-label^='Options for'] button:not([data-slot='collapsible-trigger'])", document)).not.toBeNull()),
		);
		yield* Effect.promise(() => activate("[aria-label^='Options for'] button:not([data-slot='collapsible-trigger'])"));
		yield* Effect.promise(() => eventually(() => expect(findElement("[data-answered-id='task.guide']")).not.toBeNull()));
		expect(findElement(ask)).toBeNull();
		expect(readAttribute("[data-answered-id='task.guide'] p", "title")).toBe(NEXT_PASS);
		expect(readFocus()).toBe(findElement("[data-answered-id='task.guide'] a"));
		const saved = yield* Effect.promise(() => readResponses(decisionId, "direction"));
		const [[receipt, content] = []] = Object.entries(appliedReceipt(saved.responses[0]?.id));
		editFile(receipt ?? "", content ?? "");
		yield* Effect.promise(refreshInbox);
		yield* Effect.promise(() =>
			eventually(() => expect(readAttribute("[data-answered-id='task.guide'] p", "title")).toBe("You answered: Request changes. Fleet applied it.")),
		);
	},
);

screenStory.it(
	"says what was answered on the answer card until Fleet's receipt settles the decision",
	[
		screenWorkspace("answered-waiting"),
		screenFleet(guideFleet),
		routedScreen({ ...readyDecisionFixture, "guide.md": ANSWERED_TASK }, url, { home: "home.md", writable: true }),
	],
	function* ({ click, editFile, findElement, readAttribute, readFocus, readResponses, readText, refreshDocument, responseClick }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#response-form")).not.toBeNull()));
		expect(readText(".response-panel h2")).toBe("Answer: Publish the install guide");
		expect(findElement("[data-answered]")).toBeNull();
		click("[data-choice='retry']");
		yield* Effect.promise(async () => responseClick("submit"));
		yield* Effect.promise(() => eventually(() => expect(readText("[data-answered]")).toBe(NEXT_PASS)));
		expect(readFocus()).toBe(findElement("[data-answered]"));
		expect(readText(".response-panel h2")).toBe("Answered: Publish the install guide");
		expect(readAttribute(".item-summary [data-status-token]", "data-status-token")).toBe("waiting-on-agents");
		const change = findElement<HTMLDetailsElement>("details[data-key='change-answer']");
		expect(change?.open).toBe(false);
		expect(findElement("#response-form")?.closest("details[data-key='change-answer']")).toBe(change);
		expect(readText(".response-panel")).toContain("Chose Request changes");
		const saved = yield* Effect.promise(() => readResponses(decisionId, "direction"));
		const [answer] = saved.responses;
		const [[receipt, content] = []] = Object.entries(appliedReceipt(answer?.id));
		editFile(receipt ?? "", content ?? "");
		yield* Effect.promise(() => refreshDocument(url));
		yield* Effect.promise(() => eventually(() => expect(findElement(".answer-cards")).toBeNull()));
	},
);

screenStory.it(
	"replaces the answer when the reader or someone else changes it",
	[screenWorkspace("changed-answer"), screenFleet(guideFleet), routedScreen(answeredDecisionFixture(), url, { home: "home.md", writable: true })],
	function* ({ click, findElement, findElements, readAttribute, readFocus, readResponses, readText, rememberStored, responseClick }) {
		function* change(author: string, choice: string, copy: string, replaces: string) {
			click("details[data-key='change-answer'] summary");
			expect(findElement<HTMLInputElement>("details[data-key='change-answer'] [name='supersedes']")?.value).toBe(replaces);
			expect(findElements("details[data-key='change-answer'] [role='radio']")).toHaveLength(2);
			expect(findElements("details[data-key='change-answer'] [role='radio'][aria-checked='true']")).toHaveLength(0);
			rememberStored("work-board:author:changed-answer", author);
			click(`[data-choice='${choice}']`);
			expect(readAttribute(`[data-choice='${choice}']`, "aria-checked")).toBe("true");
			yield* Effect.promise(async () => responseClick("submit"));
			yield* Effect.promise(() => eventually(() => expect(readText("[data-answered]")).toBe(copy)));
			expect(readFocus()).toBe(findElement("[data-answered]"));
			expect(readText(".response-panel h2")).toBe("Answered: Publish the install guide");
			const saved = yield* Effect.promise(() => readResponses(decisionId, "direction"));
			const latest = saved.responses.toSorted((left, right) => left.response.recordedAt - right.response.recordedAt).at(-1);
			expect(latest?.response.supersedes).toBe(replaces);
			return latest?.id ?? "";
		}
		yield* Effect.promise(() => eventually(() => expect(findElement("[data-answered]")).not.toBeNull()));
		const mine = yield* change(
			"maintainer",
			"release",
			"You answered: Stop and hand back. Fleet picks this up on its next pass.",
			"response.direction-retry",
		);
		yield* change("reviewer", "retry", "Answered by reviewer: Request changes. Fleet picks this up on its next pass.", mine);
		const saved = yield* Effect.promise(() => readResponses(decisionId, "direction"));
		expect(saved.responses).toHaveLength(3);
	},
);
