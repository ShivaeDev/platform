import { Effect } from "effect";
import { act } from "react";
import { expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { paletteFixture } from "#test/paletteFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { SearchDialog } from "./SearchDialog.tsx";

expectNoReactWarnings();

screenStory.it("offers go-to views and open goals, ranks a matching command first and shows work metadata", [], function* ({ renderBoard, click }) {
	const change = vi.fn();
	const view = yield* Effect.promise(() =>
		renderBoard(paletteFixture(), (api) => (
			<SearchDialog
				api={api}
				appearance={{ change, closed: false, density: "comfortable", notice: "", theme: "light" }}
				close={vi.fn()}
				open
				toggleSidebar={vi.fn()}
			/>
		)),
	);
	const field = view.container.querySelector("input");
	if (!field) {
		throw new Error("Missing palette input");
	}
	const input = field;
	function rows() {
		return [...view.container.querySelectorAll<HTMLAnchorElement>('[role="option"]')];
	}
	function type(text: string) {
		act(() => {
			input.value = text;
			input.dispatchEvent(new Event("input", { bubbles: true }));
		});
	}

	yield* Effect.promise(() =>
		eventually(() => expect(rows().map((row) => row.querySelector("strong")?.textContent)).toContain("Go to A calmer workspace")),
	);
	for (const [title, href] of [
		["Go to Today", "/"],
		["Go to Goals", "/_board/goals"],
		["Go to Now", "/_board/work?view=board"],
		["Go to System", "/_board/system"],
		["Go to Library", "/_board/library"],
		["Go to A calmer workspace", "/_board/item/project.workspace/"],
	]) {
		expect(
			rows()
				.find((row) => row.querySelector("strong")?.textContent === title)
				?.getAttribute("href"),
		).toBe(href);
	}
	expect(view.container.textContent).not.toContain("Go to Finished workspace");
	type("inbox");
	yield* Effect.promise(() => eventually(() => expect(rows()[0]?.querySelector("strong")?.textContent).toBe("Build the inbox")));
	expect(rows()[0]?.querySelector("code")?.textContent).toBe("task.triage");
	expect(rows()[0]?.querySelector("small")?.textContent).toContain("task");
	expect(rows()[0]?.querySelector("[data-status-token]")?.textContent).toBe("active");
	expect(view.container.textContent).not.toContain("Inbox decision");
	type("records: inbox");
	yield* Effect.promise(() =>
		eventually(() => expect(rows().some((row) => row.querySelector("strong")?.textContent === "Inbox decision 9")).toBe(true)),
	);
	expect(rows()[0]?.querySelector("strong")?.textContent).toBe("Build the inbox");
	expect(
		new Set(
			rows()
				.map((row) => row.querySelector("code")?.textContent)
				.filter((id) => id?.startsWith("decision.delivery.")),
		).size,
	).toBe(10);
	expect(view.container.textContent).not.toContain("Not recorded");
	for (const row of rows()) {
		expect(row.querySelector("p")?.textContent ?? "").not.toMatch(/^(?:\{|---)|(?:id|kind|next_action):/u);
	}
	type("workspace");
	yield* Effect.promise(() => eventually(() => expect(rows()[0]?.querySelector("strong")?.textContent).toBe("Go to A calmer workspace")));
	expect(rows().findIndex((row) => row.querySelector("strong")?.textContent === "A calmer workspace")).toBeGreaterThan(0);
	for (const query of ["project.workspace", "calmer"]) {
		type(query);
		yield* Effect.promise(() => eventually(() => expect(rows()[0]?.querySelector("strong")?.textContent).toBe("Go to A calmer workspace")));
		const destinations = rows().map((row) => row.getAttribute("href"));
		expect(new Set(destinations).size).toBe(destinations.length);
		expect(destinations.filter((href) => href === "/_board/item/project.workspace/")).toHaveLength(1);
	}
	type("Library");
	yield* Effect.promise(() => eventually(() => expect(rows()[0]?.getAttribute("href")).toBe("/_board/library")));
	type("theme");
	yield* Effect.promise(() => eventually(() => expect(rows()[0]?.dataset.command).toBe("theme")));
	click(rows()[0]);
	expect(change).toHaveBeenCalledWith({ theme: "dark" });
});
