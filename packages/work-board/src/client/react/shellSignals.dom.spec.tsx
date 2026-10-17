import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { documentQuery, navigationQuery } from "#client/page/routeQuery.ts";
import { browserStorage } from "#test/browserStorage.ts";
import { chrome, click, control } from "#test/chrome.ts";
import { renderRouter } from "#test/renderRouter.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
beforeEach(() => {
	browserStorage();
	vi.stubGlobal("matchMedia", (query: string) => ({
		addEventListener: () => undefined,
		matches: query.includes("max-width"),
		removeEventListener: () => undefined,
	}));
});
afterEach(() => vi.unstubAllGlobals());

it("closes Files and More on direct router navigation and retains the new recent title", async () => {
	const files = { "home.md": "# Home", "notes/plan.md": "# Plan", "other.md": "# Other" };
	const view = await chrome(files);
	try {
		click("#sidebar-toggle");
		expect(control("#sidebar", HTMLElement).hidden).toBe(false);
		await act(async () => view.router.navigate({ to: "/other.md" }));
		await eventually(() => expect(control("#sidebar", HTMLElement).hidden).toBe(true));
		click('[aria-controls="phone-more"]');
		expect(control("#phone-more", HTMLDialogElement).open).toBe(true);
		await act(async () => view.router.navigate({ to: "/notes/plan.md" }));
		await eventually(() => expect(control("#phone-more", HTMLDialogElement).open).toBe(false));
		files["notes/plan.md"] = "# Revised plan";
		act(() => {
			view.registry.refresh(navigationQuery(view.api));
			view.registry.refresh(documentQuery(view.api, "/notes/plan.md"));
		});
		await eventually(() => expect(document.querySelector('section[aria-label="Recent"] a[aria-current="page"]')?.textContent).toBe("Revised plan"));
		expect(document.title).toBe("Revised plan · Work Board");
	} finally {
		await view.unmount();
	}
});

it("restores the passage after DocumentContext reports its outline ready", async () => {
	const view = await renderRouter({ "notes/plan.md": "# Plan\n\n## Evidence\n\nRead this passage." }, "/notes/plan.md#heading-evidence");
	try {
		await eventually(() => expect(document.querySelector('.document-outline a[href="#heading-evidence"]')).not.toBeNull());
		await eventually(() => expect(document.activeElement?.id).toBe("heading-evidence"));
	} finally {
		await view.unmount();
	}
});
