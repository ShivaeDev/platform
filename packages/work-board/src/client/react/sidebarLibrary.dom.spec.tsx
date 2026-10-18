import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { browserStorage } from "#test/browserStorage.ts";
import { choose, chrome, click, control } from "#test/chrome.ts";
import { goalsFixture } from "#test/goalsFixture.ts";
import { inboxFixture } from "#test/inboxFixture.ts";
import { navigationQuery } from "./routeQuery.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
beforeEach(() => {
	browserStorage();
	document.documentElement.dataset.workspace = "library-fixture";
});
afterEach(() => {
	vi.unstubAllGlobals();
	delete document.documentElement.dataset.workspace;
});
it("bounds document shell links with 1,500 files and shows titled pinned, goal and recent sections", async () => {
	const files = Object.fromEntries(Array.from({ length: 1490 }, (_, index) => [`notes/slug-${index}.md`, `# Document title ${index}\n`]));
	const saved = Array.from({ length: 10 }, (_, index) => ({ file: `notes/slug-${index}.md`, title: `Document title ${index}` }));
	localStorage.setItem("work-board:library:library-fixture", JSON.stringify({ favorites: saved.slice(0, 2), recents: saved }));
	const view = await chrome({ ...files, ...goalsFixture() }, "/notes/slug-0.md");
	try {
		expect([...document.querySelectorAll("#primary-navigation a > span:first-child")].map((node) => node.textContent)).toEqual([
			"Today",
			"Goals",
			"Now",
			"Library",
			"System",
		]);
		for (const name of ["Pinned", "Active goals", "Recent"]) {
			expect(document.querySelector(`section[aria-label="${name}"]`)).not.toBeNull();
		}
		expect(document.querySelectorAll('section[aria-label="Recent"] a')).toHaveLength(5);
		expect(document.querySelector('section[aria-label="Pinned"] a')?.textContent).toBe("Document title 0");
		await eventually(() =>
			expect(document.querySelector('section[aria-label="Active goals"] [role="img"][aria-label^="Example goal"]')?.getAttribute("aria-label")).toBe(
				"Example goal: 2 of 5 done",
			),
		);
		expect(document.querySelector('section[aria-label="Active goals"]')?.textContent).toContain("2/5");
		expect(document.querySelectorAll('section[aria-label="Active goals"] [data-status-token]')).toHaveLength(0);
		for (const id of ["#documents-open", "#diagnostics-open", "#goals-open"]) {
			expect(document.querySelector(id)?.textContent).not.toMatch(/[0-9?]/u);
		}
		expect(document.querySelector("#files")).toBeNull();
		expect(document.querySelectorAll("a").length).toBeLessThan(100);
		const navigation = view.registry.get(navigationQuery(view.api));
		expect(navigation._tag).toBe("Success");
		if (navigation._tag === "Success") {
			expect(navigation.value.counts.library).toBe(1500);
			expect(navigation.value).not.toHaveProperty("tree");
			expect(navigation.value).not.toHaveProperty("records");
		}
		click("#work-open");
		await eventually(() => expect(document.querySelector(".work-head h1")?.textContent).toBe("Now"));
	} finally {
		await view.unmount();
	}
});
it("browses titles, filters kinds and statuses, hides records and requests folders only as expanded", async () => {
	const view = await chrome(
		{ ...inboxFixture(), "notes/deep/other.md": "# Nested title\n", "notes/slug.md": "---\nkind: task\nstatus: active\n---\n# A readable title\n" },
		"/notes/slug.md",
	);
	const query = vi.spyOn(view.api.library, "query");
	try {
		expect(query).not.toHaveBeenCalled();
		await act(async () => view.router.navigate({ to: "/_board/library" }));
		await eventually(() => expect(document.querySelector('#doc a[href="/notes/slug.md"]')?.textContent).toBe("A readable title"));
		expect(document.querySelector('#doc a[href="/responses/decision.md"]')).toBeNull();
		expect(document.querySelector("#doc")?.textContent).toContain("Show Fleet records (1)");
		choose("#doc label:has(select) select", "task");
		await eventually(() => expect(document.querySelector('#doc a[href="/question.md"]')).toBeNull());
		const selects = document.querySelectorAll<HTMLSelectElement>("#doc select");
		act(() => {
			const select = selects[1];
			if (select) {
				select.value = "active";
				select.dispatchEvent(new Event("change", { bubbles: true }));
			}
		});
		await eventually(() => expect(document.querySelectorAll("#doc li a")).toHaveLength(1));
		act(() => {
			for (const select of [...selects].slice(0, 2)) {
				select.value = "";
				select.dispatchEvent(new Event("change", { bubbles: true }));
			}
		});
		click('#doc input[type="checkbox"]');
		await eventually(() => expect(document.querySelector('#doc a[href="/responses/decision.md"]')?.textContent).toBe("Fleet delivery decision"));
		act(() => {
			const select = selects[2];
			if (select) {
				select.value = "folders";
				select.dispatchEvent(new Event("change", { bubbles: true }));
			}
		});
		await eventually(() => expect(document.querySelector("#doc summary")?.textContent).toContain("notes"));
		expect(document.querySelector('#doc a[href="/notes/slug.md"]')).toBeNull();
		expect(query.mock.calls.some(([input]) => input.folder === "notes")).toBe(false);
		act(() => {
			const folder = control("#doc details", HTMLDetailsElement);
			folder.open = true;
			folder.dispatchEvent(new Event("toggle"));
		});
		await eventually(() => expect(document.querySelector('#doc a[href="/notes/slug.md"]')?.textContent).toBe("A readable title"));
		expect(document.querySelector('#doc a[href="/notes/deep/other.md"]')).toBeNull();
		expect(query.mock.calls.some(([input]) => input.folder === "notes/deep")).toBe(false);
	} finally {
		query.mockRestore();
		await view.unmount();
	}
});
