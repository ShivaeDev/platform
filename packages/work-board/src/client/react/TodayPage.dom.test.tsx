import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { todayFixture } from "#test/todayFixture.ts";

expectNoReactWarnings();
const ASK = "[data-attention-id='question.storage']";
const trigger = `${ASK} button[aria-haspopup='dialog']`;
const dialog = `${ASK} [role='dialog']`;
screenStory.it(
	"opens compact answer controls, records an option and removes its ask on query refresh",
	[routedScreen(todayFixture(), "/", { home: "home.md", writable: true })],
	function* ({ readText, readAttribute, readFocus, findElement, click, keyboard, readResponses, activate }) {
		yield* Effect.promise(() =>
			eventually(() => expect(readText("[aria-label='Options for question.storage'] button")).toContain("Keep local files · Recommended")),
		);
		expect(findElement(dialog)).toHaveProperty("hidden", true);
		expect(readAttribute(trigger, "aria-expanded")).toBe("false");
		click(trigger);
		yield* Effect.promise(() => eventually(() => expect(findElement(dialog)).toHaveProperty("hidden", false)));
		expect(readFocus()?.textContent).toContain("Keep local files · Recommended");
		keyboard("Escape");
		expect(findElement(dialog)).toHaveProperty("hidden", true);
		expect(readFocus()).toBe(findElement(trigger));
		click(trigger);
		yield* Effect.promise(() => activate("[aria-label='Options for question.storage'] button"));
		yield* Effect.promise(() => eventually(() => expect(findElement(ASK)).toBeNull()));
		const saved = yield* Effect.promise(() => readResponses("question.storage", "answer"));
		expect(saved.responses).toHaveLength(1);
		expect(saved.responses[0]?.response).toMatchObject({ answers: [{ prompt: "answer", selected: ["option-1"], text: "" }], type: "answer" });
	},
);

screenStory.it(
	"opens Today without a configured home and preserves empty-workspace guidance",
	[routedScreen({}, "/", { home: undefined })],
	function* ({ readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe("Today")));
		expect(readText(".today-strip")).toBe("0 need you·? in progress·0 active goals");
		expect(readText(".today-page a[href='/_board/start']")).toBe("Getting started");
	},
);
