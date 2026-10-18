import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eventually, expectNoReactWarnings, render } from "@shivaedev/effect-react/testing.ts";
import { documentQuery } from "#client/page/routeQuery.ts";
import { browserStorage } from "#test/browserStorage.ts";
import { control } from "#test/chrome.ts";
import { renderRouter } from "#test/renderRouter.tsx";
import { scheduleReading } from "./scheduleReading.ts";
import { shellIds } from "./shellIds.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
beforeEach(() => {
	browserStorage();
	sessionStorage.clear();
	window.history.replaceState({}, "", "/");
});
afterEach(async () => {
	await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it("restores a valid saved passage once after readiness, on the queued frame, without scrolling or focusing the heading", async () => {
	const passageId = "heading-evidence";
	const view = await render(
		<article id={shellIds.doc}>
			<h2 id={passageId} tabIndex={-1}>
				Evidence
			</h2>
		</article>,
	);
	const anchoring = document.documentElement.style.overflowAnchor;
	try {
		const scroll = vi.spyOn(window, "scrollTo");
		const focus = vi.spyOn(HTMLElement.prototype, "focus");
		const passage = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
		const status = vi.fn();
		act(() => {
			scheduleReading(control("#doc", HTMLElement), { scroll: [0, 480], selection: null }, passageId, () => true, status, false);
		});
		await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
		expect(document.documentElement.style.overflowAnchor).toBe("none");
		await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
		expect(scroll.mock.calls).toEqual([[0, 480]]);
		expect(status.mock.calls).toEqual([[""]]);
		expect(passage).not.toHaveBeenCalled();
		expect(focus).not.toHaveBeenCalled();
		expect(document.documentElement.style.overflowAnchor).toBe(anchoring);
	} finally {
		await view.unmount();
	}
});

it.each(["Back", "reload"])("reports a missing saved passage after %s while retaining restored reading position", async (navigation) => {
	const files = {
		"home.md": "# Home\n",
		"notes/plan.md": "# Plan\n\n## Evidence\n\nRead this passage.\n\n<details><summary>More</summary>Saved reading details.</details>\n",
		"other.md": "# Other\n",
	};
	const url = "/notes/plan.md#heading-evidence";
	let view = await renderRouter(files, url);
	try {
		await eventually(() => expect(document.activeElement?.id).toBe("heading-evidence"));
		const api = view.router.options.context?.shell?.api;
		if (!api) {
			throw new Error("Missing shell API");
		}
		files["notes/plan.md"] = "# Plan\n\nThe heading disappeared.\n\n<details><summary>More</summary>Saved reading details.</details>\n";
		await act(async () => view.registry.refresh(documentQuery(api, "/notes/plan.md")));
		await eventually(() => expect(control("#doc", HTMLElement).textContent).toContain("The heading disappeared."));
		control("article details:not(.item-context)", HTMLDetailsElement).open = true;
		vi.spyOn(window, "scrollY", "get").mockReturnValue(480);
		if (navigation === "Back") {
			await act(async () => view.router.navigate({ to: "/other.md" }));
			await eventually(() => expect(control("#doc h1", HTMLElement).textContent).toBe("Other"));
			await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
		} else {
			act(() => window.dispatchEvent(new Event("pagehide")));
			const state = view.router.state.location.state;
			await view.unmount();
			window.history.replaceState({ workBoard: { id: state.key } }, "");
		}
		vi.spyOn(window, "scrollY", "get").mockReturnValue(0);
		const scroll = vi.spyOn(window, "scrollTo");
		const focus = vi.spyOn(HTMLElement.prototype, "focus");
		const passage = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
		const previousFocus = document.activeElement;
		if (navigation === "Back") {
			await act(async () => view.router.history.back());
		} else {
			view = await renderRouter(files, url);
		}
		await eventually(() => expect(control("#navigation-status", HTMLElement).textContent).toBe("This passage is no longer in the document."));
		expect(view.router.state.location.hash).toBe("heading-evidence");
		expect(control("article details:not(.item-context)", HTMLDetailsElement).open).toBe(true);
		expect(scroll.mock.calls).toEqual([[0, 480]]);
		expect(passage).not.toHaveBeenCalled();
		expect(focus).toHaveBeenCalledTimes(navigation === "Back" ? 1 : 0);
		expect(document.activeElement).toBe(navigation === "Back" ? control("#doc", HTMLElement) : previousFocus);
	} finally {
		await view.unmount();
	}
});
