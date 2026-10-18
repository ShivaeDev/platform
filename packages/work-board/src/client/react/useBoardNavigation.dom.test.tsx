import { Effect } from "effect";
import { act } from "react";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { documentQuery } from "./routeQuery.ts";

expectNoReactWarnings();
beforeEach(() => {
	sessionStorage.clear();
	window.history.replaceState({}, "", "/");
});
afterEach(() => vi.unstubAllGlobals());

screenStory.it("clears a recovered current-document refresh failure without restoring reading position", [], function* ({ renderRouter, control }) {
	let failed = false;
	const view = yield* Effect.promise(() =>
		renderRouter({ "home.md": "# Home", "notes/plan.md": "# Plan\n\n## Evidence\n\nRead this passage.\n" }, "/notes/plan.md#heading-evidence", {
			beforeRead: () => (failed ? Effect.die(new Error("Read unavailable")) : Effect.void),
			home: "home.md",
		}),
	);
	try {
		yield* Effect.promise(() => eventually(() => expect(control("#doc", HTMLElement).dataset.status).toBe("200")));
		yield* Effect.promise(() => eventually(() => expect(document.activeElement?.id).toBe("heading-evidence")));
		const api = view.router.options.context?.shell?.api;
		if (!api) {
			throw new Error("Missing shell API");
		}
		const query = documentQuery(api, "/notes/plan.md");
		function refresh() {
			view.registry.refresh(query);
		}
		const location = view.router.state.location;
		const doc = control("#doc", HTMLElement);
		const focused = control("#search-open", HTMLButtonElement);
		focused.focus();
		vi.spyOn(window, "scrollY", "get").mockReturnValue(480);
		const scroll = vi.spyOn(window, "scrollTo");
		const passage = vi.spyOn(control("#heading-evidence", HTMLElement), "scrollIntoView");
		failed = true;
		yield* Effect.promise(() => act(async () => refresh()));
		yield* Effect.promise(() =>
			eventually(() => expect(control("#navigation-status", HTMLElement).textContent).toContain("Could not open this document")),
		);
		expect(doc.dataset.status).toBe("503");
		expect(doc.textContent).toContain("Read this passage.");
		failed = false;
		yield* Effect.promise(() => act(async () => refresh()));
		yield* Effect.promise(() => eventually(() => expect(doc.dataset.status).toBe("200")));
		yield* Effect.promise(() => eventually(() => expect(control("#navigation-status", HTMLElement).textContent).toBe("")));
		yield* Effect.promise(() => act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))));
		expect(view.router.state.location).toBe(location);
		expect(control("#doc", HTMLElement)).toBe(doc);
		expect(document.activeElement).toBe(focused);
		expect(window.scrollY).toBe(480);
		expect(scroll).not.toHaveBeenCalled();
		expect(passage).not.toHaveBeenCalled();
	} finally {
		yield* Effect.promise(() => view.unmount());
		vi.restoreAllMocks();
	}
});
