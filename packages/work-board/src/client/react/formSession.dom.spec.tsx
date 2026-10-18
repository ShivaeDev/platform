import { Effect } from "effect";
import { act } from "react";
import { afterEach, expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { session } from "#client/session.ts";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});
for (const kind of ["response", "handoff"] as const) {
	screenStory.it(
		`saves ${kind} through the replacement session's command and runtime after pageshow`,
		[],
		function* ({ mountSession, input, click, submit }) {
			const { container, environment, first } = yield* mountSession(kind);
			const oldCommand = vi.spyOn(kind === "response" ? first.responses.recordResponse : first.handoffs.prepareHandoff, "run");
			yield* Effect.promise(() => eventually(() => expect(document.getElementById(`${kind}-form`), `${container.textContent}`).not.toBeNull()));
			input(kind === "response" ? '[name="author"]' : '[name="recipient"]', "local-reviewer");
			input(kind === "response" ? '[name="body"]' : '[name="goal"]', "Direction before replacement");
			let replacement = first;
			let command = oldCommand;
			let runtime = vi.spyOn(first.runtime, "fn");
			yield* Effect.sync(() => {
				act(() => {
					window.dispatchEvent(new Event("pagehide"));
					replacement = session(environment);
					runtime = vi.spyOn(replacement.runtime, "fn");
					command = vi.spyOn(kind === "response" ? replacement.responses.recordResponse : replacement.handoffs.prepareHandoff, "run");
					window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
				});
			});
			expect(replacement).not.toBe(first);
			yield* Effect.promise(() => eventually(() => expect(document.getElementById(`${kind}-preview`)).toHaveProperty("disabled", false)));
			expect(container.querySelector(kind === "response" ? '[name="body"]' : '[name="goal"]')).toHaveProperty(
				"value",
				"Direction before replacement",
			);
			click(`#${kind}-preview`);
			submit(`#${kind}-form`);
			yield* Effect.promise(() =>
				eventually(() => expect(document.getElementById(`${kind}-status`)?.textContent).toContain(kind === "response" ? "Saved:" : "Prepared:")),
			);
			expect(runtime).toHaveBeenCalled();
			expect(command).toHaveBeenCalledTimes(1);
			expect(oldCommand).not.toHaveBeenCalled();
		},
	);
}
