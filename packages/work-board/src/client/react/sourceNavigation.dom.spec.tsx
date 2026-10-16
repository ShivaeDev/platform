import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { attentionFixture } from "#test/attentionFixture.ts";
import { browserStorage } from "#test/browserStorage.ts";
import { click, control, input } from "#test/chrome.ts";
import { renderRouter } from "#test/renderRouter.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
beforeEach(() => {
	browserStorage();
	sessionStorage.clear();
	window.history.replaceState({}, "", "/");
});
afterEach(() => vi.restoreAllMocks());

const SOURCE = "/attention/review.md#attention-request-keyboard-review";
function expectSource() {
	const target = control("#attention-request-keyboard-review", HTMLElement);
	expect(target.closest("[hidden]")).toBeNull();
	expect(target.closest('[role="tabpanel"]')?.getAttribute("aria-labelledby")).toBe(
		control('.item-context [role="tab"][aria-selected="true"]', HTMLElement).id,
	);
	expect(control('.item-context [role="tab"][aria-selected="true"]', HTMLElement).textContent).toBe("Source");
}

it.each([
	{ mode: "direct", url: SOURCE },
	{ mode: "overview", url: "/_board/overview" },
	{ mode: "search", url: "/attention/review.md" },
	{ mode: "same-document", url: "/attention/review.md" },
])("reveals and focuses an attention source passage through $mode navigation", async ({ mode, url }) => {
	const view = await renderRouter(attentionFixture(), url);
	try {
		if (mode === "overview") {
			await eventually(() => expect(view.container.querySelector('[data-request="keyboard-review"] .attention-source')).not.toBeNull());
			click('[data-request="keyboard-review"] .attention-source');
		}
		if (mode === "search") {
			await eventually(() => expect(view.container.querySelector(".item-summary")).not.toBeNull());
			click("#search-open");
			input("#search-query", "keyboard-review");
			const result = '[role="option"][href$="#attention-request-keyboard-review"]';
			await eventually(() => expect(view.container.querySelector(result)).not.toBeNull());
			click(result);
		}
		if (mode === "same-document") {
			await eventually(() => expect(view.container.querySelector(".item-summary")).not.toBeNull());
			expect(control('.item-context [role="tab"][aria-selected="true"]', HTMLElement).textContent).toBe("Details");
			await act(async () => view.router.navigate({ to: SOURCE }));
		}
		await eventually(() => expect(document.activeElement?.id).toBe("attention-request-keyboard-review"));
		expectSource();
		await act(async () => view.router.navigate({ to: "/decision.md" }));
		await eventually(() => expect(view.container.querySelector("main")?.getAttribute("data-route")).toBe("/decision.md"));
		await act(async () => view.router.history.back());
		await eventually(expectSource);
	} finally {
		await view.unmount();
	}
});
