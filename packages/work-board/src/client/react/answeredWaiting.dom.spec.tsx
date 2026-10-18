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
const ANSWERED = "[aria-label='Answered, waiting for Fleet']";
const NEXT_PASS = "You answered: Request changes. Fleet picks this up on its next pass.";
const FLEET_DOWN = "You answered: Request changes. Fleet is unavailable, so it picks this up once it runs again.";

screenStory.it(
	"moves an answered Fleet decision out of Needs you until Fleet's receipt settles it",
	[screenFleet(guideFleet), routedScreen(answeredDecisionFixture(), "/", { home: "home.md" })],
	function* ({ editFile, findElement, findElements, readAttribute, readText, refreshInbox }) {
		yield* Effect.promise(() => eventually(() => expect(findElement(`ul${ANSWERED}`)).not.toBeNull()));
		expect([...findElements(`ul${ANSWERED} > li p`)].map((row) => row.getAttribute("title"))).toEqual([NEXT_PASS]);
		expect(readText(`ul${ANSWERED} > li a`)).toBe("Publish the install guide");
		expect(readAttribute(`ul${ANSWERED} [data-status-token]`, "data-status-token")).toBe("waiting-on-agents");
		expect(findElement("ul[aria-label='Needs you']")).toBeNull();
		expect(readText("#needs-you")).toContain("All quiet — nothing needs you.");
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
			"orchestrator answered: Request changes. Fleet picks this up on its next pass.",
		]);
	},
);

for (const [fleet, copy] of [
	[true, NEXT_PASS],
	[false, FLEET_DOWN],
] as const) {
	screenStory.it(
		`marks the Now card answered and waiting for Fleet (Fleet ready=${fleet})`,
		[...(fleet ? [screenFleet(guideFleet)] : []), routedScreen(answeredDecisionFixture(), "/_board/work", { home: "home.md" })],
		function* ({ findElement, readAttribute, readText }) {
			const card = "[aria-label='Waiting on a person'] [data-item='task.guide']";
			yield* Effect.promise(() => eventually(() => expect(findElement(card)).not.toBeNull()));
			expect(readAttribute(`${card} [data-status-token]`, "data-status-token")).toBe("waiting-on-agents");
			expect(readText(`${card} [data-status-token]`)).toBe("waiting-on-agents");
			expect(readText(`${card} .work-answer`)).toBe(copy);
		},
	);
}

screenStory.it(
	"says what was answered on the answer card until Fleet's receipt settles the decision",
	[
		screenWorkspace("answered-waiting"),
		screenFleet(guideFleet),
		routedScreen({ ...readyDecisionFixture, "guide.md": ANSWERED_TASK }, url, { home: "home.md", writable: true }),
	],
	function* ({ answerInput, click, editFile, findElement, readAttribute, readResponses, readText, refreshDocument, responseClick }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#response-form")).not.toBeNull()));
		expect(readText(".response-panel h2")).toBe("Answer: Publish the install guide");
		expect(findElement("[data-answered]")).toBeNull();
		answerInput("author", "maintainer");
		click(findElement<HTMLButtonElement>("[data-choice='retry']"));
		yield* Effect.promise(async () => responseClick("submit"));
		yield* Effect.promise(() => eventually(() => expect(readText("[data-answered]")).toBe(NEXT_PASS)));
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
