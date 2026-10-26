import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/react/client/testing.ts";
import { screenMedia } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { todayLongQuestionFixture } from "#test/todayLongQuestionFixture.ts";

expectNoReactWarnings();

for (const phone of [false, true]) {
	for (const mode of ["text", "one"] as const) {
		screenStory.it(
			`answers a long question before its collapsed context on ${phone ? "phone" : "desktop"}, with ${mode === "text" ? "text" : "options"}`,
			[
				screenMedia(phone ? ["(max-width: 767px)", "(any-pointer: coarse)"] : []),
				routedScreen(todayLongQuestionFixture(mode), "/", { home: "home.md", writable: true }),
			],
			function* ({ findElement, readResponses, roles }) {
				const answer = { name: "Answer Plan the release", role: "button" };
				yield* eventually(() => expect(roles.text(answer)).toBe("Answer"));
				yield* roles.click(answer);
				const panel = findElement("[role='dialog']", document);
				expect(panel?.textContent).toContain("When should we release?");
				const context = panel?.querySelector("[data-slot='collapsible-trigger']");
				expect(context?.getAttribute("aria-expanded")).toBe("false");
				expect(panel?.textContent).not.toContain("The release has a long history");
				const control = panel?.querySelector(mode === "text" ? "button[type='submit']" : "fieldset button");
				expect(Boolean(control && context && control.compareDocumentPosition(context) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
				expect(roles.text({ name: "Read the full question", role: "link" })).toBe("Read the full question");
				yield* roles.click({ name: "Item context", role: "button" });
				yield* eventually(() => expect(panel?.textContent).toContain("The release has a long history"));
				yield* roles.click({ name: "Item context", role: "button" });
				if (mode === "text") {
					yield* roles.enter({ name: "When should we release?", role: "textbox" }, "Monday after review.");
					yield* roles.click({ name: "Record answer", role: "button" });
				} else {
					yield* roles.click({ name: "Monday The team is available.", role: "button" });
				}
				yield* eventually(() => expect(findElement("[role='dialog']", document)).toBeNull());
				const saved = yield* Effect.promise(() => readResponses("decision.release", "direction"));
				expect(saved.responses.map((entry) => entry.response.answers)).toEqual([
					[{ prompt: "release", selected: mode === "one" ? ["monday"] : [], text: mode === "text" ? "Monday after review." : "" }],
				]);
			},
		);
	}
}
