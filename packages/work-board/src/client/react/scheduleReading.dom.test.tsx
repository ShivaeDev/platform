import { Effect } from "effect";
import { act } from "react";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { documentQuery } from "./routeQuery.ts";
import { scheduleReading } from "./scheduleReading.ts";
import { shellIds } from "./shellIds.ts";

expectNoReactWarnings();
beforeEach(() => {
	sessionStorage.clear();
	window.history.replaceState({}, "", "/");
});
afterEach(async () => {
	await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

screenStory.it(
	"restores a valid saved passage once after readiness, on the queued frame, without scrolling or focusing the heading",
	[],
	function* ({ render, control }) {
		const passageId = "heading-evidence";
		yield* Effect.promise(() =>
			render(
				<article id={shellIds.doc}>
					<h2 id={passageId} tabIndex={-1}>
						Evidence
					</h2>
				</article>,
			),
		);
		const anchoring = document.documentElement.style.overflowAnchor;

		const scroll = vi.spyOn(window, "scrollTo");
		const focus = vi.spyOn(HTMLElement.prototype, "focus");
		const passage = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
		const status = vi.fn();
		act(() => {
			scheduleReading(control("#doc", HTMLElement), { scroll: [0, 480], selection: null }, passageId, () => true, status, false);
		});
		yield* Effect.promise(() => act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))));
		expect(document.documentElement.style.overflowAnchor).toBe("none");
		yield* Effect.promise(() => act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))));
		expect(scroll.mock.calls).toEqual([[0, 480]]);
		expect(status.mock.calls).toEqual([[""]]);
		expect(passage).not.toHaveBeenCalled();
		expect(focus).not.toHaveBeenCalled();
		expect(document.documentElement.style.overflowAnchor).toBe(anchoring);
	},
);

for (const navigation of ["Back", "reload"]) {
	screenStory.it(
		`reports a missing saved passage after ${navigation} while retaining restored reading position`,
		[],
		function* ({ renderRouter, control, navigate }) {
			const files = {
				"home.md": "# Home\n",
				"notes/plan.md": "# Plan\n\n## Evidence\n\nRead this passage.\n\n<details><summary>More</summary>Saved reading details.</details>\n",
				"other.md": "# Other\n",
			};
			const url = "/notes/plan.md#heading-evidence";
			let view = yield* Effect.promise(() => renderRouter(files, url));

			yield* Effect.promise(() => eventually(() => expect(document.activeElement?.id).toBe("heading-evidence")));
			const api = view.router.options.context?.shell?.api;
			if (!api) {
				throw new Error("Missing shell API");
			}
			files["notes/plan.md"] = "# Plan\n\nThe heading disappeared.\n\n<details><summary>More</summary>Saved reading details.</details>\n";
			yield* Effect.promise(() => act(async () => view.registry.refresh(documentQuery(api, "/notes/plan.md"))));
			yield* Effect.promise(() => eventually(() => expect(control("#doc", HTMLElement).textContent).toContain("The heading disappeared.")));
			control("article details:not(.item-context)", HTMLDetailsElement).open = true;
			vi.spyOn(window, "scrollY", "get").mockReturnValue(480);
			if (navigation === "Back") {
				yield* Effect.promise(() => navigate("/other.md"));
				yield* Effect.promise(() => eventually(() => expect(control("#doc h1", HTMLElement).textContent).toBe("Other")));
				yield* Effect.promise(() => act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))));
			} else {
				act(() => window.dispatchEvent(new Event("pagehide")));
				const state = view.router.state.location.state;
				yield* Effect.promise(() => view.unmount());
				window.history.replaceState({ workBoard: { id: state.key } }, "");
			}
			vi.spyOn(window, "scrollY", "get").mockReturnValue(0);
			const scroll = vi.spyOn(window, "scrollTo");
			const focus = vi.spyOn(HTMLElement.prototype, "focus");
			const passage = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
			const previousFocus = document.activeElement;
			if (navigation === "Back") {
				yield* Effect.promise(() => act(async () => view.router.history.back()));
			} else {
				view = yield* Effect.promise(() => renderRouter(files, url));
			}
			yield* Effect.promise(() =>
				eventually(() => expect(control("#navigation-status", HTMLElement).textContent).toBe("This passage is no longer in the document.")),
			);
			expect(view.router.state.location.hash).toBe("heading-evidence");
			expect(control("article details:not(.item-context)", HTMLDetailsElement).open).toBe(true);
			expect(scroll.mock.calls).toEqual([[0, 480]]);
			expect(passage).not.toHaveBeenCalled();
			expect(focus).toHaveBeenCalledTimes(navigation === "Back" ? 1 : 0);
			expect(document.activeElement).toBe(navigation === "Back" ? control("#doc", HTMLElement) : previousFocus);
		},
	);
}
