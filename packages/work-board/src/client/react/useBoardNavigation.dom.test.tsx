import { Effect } from "effect";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { browserStorage } from "#test/browserStorage.ts";
import { control } from "#test/chrome.ts";
import { renderRouter } from "#test/renderRouter.tsx";
import { documentQuery } from "./routeQuery.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
beforeEach(() => {
	browserStorage();
	sessionStorage.clear();
	window.history.replaceState({}, "", "/");
});
afterEach(() => vi.unstubAllGlobals());

it("clears a recovered current-document refresh failure without restoring reading position", async () => {
	let failed = false;
	const view = await renderRouter(
		{ "home.md": "# Home", "notes/plan.md": "# Plan\n\n## Evidence\n\nRead this passage.\n" },
		"/notes/plan.md#heading-evidence",
		{ beforeRead: () => (failed ? Effect.die(new Error("Read unavailable")) : Effect.void), home: "home.md" },
	);
	try {
		await eventually(() => expect(control("#doc", HTMLElement).dataset.status).toBe("200"));
		await eventually(() => expect(document.activeElement?.id).toBe("heading-evidence"));
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
		await act(async () => refresh());
		await eventually(() => expect(control("#navigation-status", HTMLElement).textContent).toContain("Could not open this document"));
		expect(doc.dataset.status).toBe("503");
		expect(doc.textContent).toContain("Read this passage.");
		failed = false;
		await act(async () => refresh());
		await eventually(() => expect(doc.dataset.status).toBe("200"));
		await eventually(() => expect(control("#navigation-status", HTMLElement).textContent).toBe(""));
		await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
		expect(view.router.state.location).toBe(location);
		expect(control("#doc", HTMLElement)).toBe(doc);
		expect(document.activeElement).toBe(focused);
		expect(window.scrollY).toBe(480);
		expect(scroll).not.toHaveBeenCalled();
		expect(passage).not.toHaveBeenCalled();
	} finally {
		await view.unmount();
		vi.restoreAllMocks();
	}
});
