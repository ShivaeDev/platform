import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { screenStory } from "#test/screenStory.ts";
import { sessionScreen } from "#test/sessionScreen.ts";

expectNoReactWarnings();
for (const kind of ["response", "handoff"] as const) {
	screenStory.it(
		`saves ${kind} through the replacement session after pageshow`,
		[sessionScreen(kind)],
		function* ({ input, click, submit, findElement, readText, readSession, restoreSession, readSessionFiles }) {
			const first = readSession();
			yield* eventually(() => expect(findElement(`#${kind}-form`)).not.toBeNull());
			const field = kind === "response" ? '[name="body"]' : '[name="goal"]';
			if (kind === "handoff") {
				input('[name="recipient"]', "local-reviewer");
			}
			input(field, "Direction before replacement");
			restoreSession();
			expect(readSession()).not.toBe(first);
			yield* eventually(() => expect(findElement(`#${kind}-preview`)).toHaveProperty("disabled", false));
			expect(findElement(field)).toHaveProperty("value", "Direction before replacement");
			click(`#${kind}-preview`);
			submit(`#${kind}-form`);
			yield* eventually(() => expect(readText(`#${kind}-status`)).toContain(kind === "response" ? "Answer saved." : "Saved handoffs/"));
			if (kind === "response") {
				expect(readText("#response-status")).toContain("not acceptance");
			}
			const records = readSessionFiles(kind === "response" ? "responses" : "handoffs");
			expect(records).toEqual(
				kind === "response"
					? [expect.stringContaining("item: item.edge"), expect.stringContaining("Direction before replacement")]
					: [expect.stringContaining("Direction before replacement")],
			);
		},
	);
}
