import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { sessionScreen } from "#test/sessionScreen.ts";

expectNoReactWarnings();
for (const kind of ["response", "handoff"] as const) {
	screenStory.it(
		`saves ${kind} through the replacement session after pageshow`,
		[sessionScreen(kind)],
		function* ({ input, click, submit, findElement, readText, readSession, restoreSession, readSessionFiles }) {
			const first = readSession();
			yield* Effect.promise(() => eventually(() => expect(findElement(`#${kind}-form`)).not.toBeNull()));
			const field = kind === "response" ? '[name="body"]' : '[name="goal"]';
			input(kind === "response" ? '[name="author"]' : '[name="recipient"]', "local-reviewer");
			input(field, "Direction before replacement");
			restoreSession();
			expect(readSession()).not.toBe(first);
			yield* Effect.promise(() => eventually(() => expect(findElement(`#${kind}-preview`)).toHaveProperty("disabled", false)));
			expect(findElement(field)).toHaveProperty("value", "Direction before replacement");
			click(`#${kind}-preview`);
			submit(`#${kind}-form`);
			yield* Effect.promise(() =>
				eventually(() => expect(readText(`#${kind}-status`)).toContain(kind === "response" ? "Saved:" : "Saved handoffs/")),
			);
			const records = readSessionFiles(kind === "response" ? "responses" : "handoffs");
			expect(records.filter((source) => source.includes("Direction before replacement"))).toHaveLength(1);
		},
	);
}
