import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { paletteFixture } from "#test/paletteFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { searchScreen } from "#test/searchScreen.tsx";

expectNoReactWarnings();
const QUERY = '#search-dialog [role="combobox"]';

screenStory.it(
	"offers go-to views and open goals, ranks a matching command first and shows work metadata",
	[searchScreen(paletteFixture())],
	function* ({ readRootAttribute, input, click, findElements, readText }) {
		function rows() {
			return findElements<HTMLElement>('#search-dialog [role="option"]', document);
		}

		yield* Effect.promise(() => eventually(() => expect(rows().map((row) => readText("strong", row))).toContain("Go to A calmer workspace")));
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
					.find((row) => readText("strong", row) === title)
					?.querySelector("a")
					?.getAttribute("href"),
			).toBe(href);
		}
		expect(readText("#search-dialog", document)).not.toContain("Go to Finished workspace");
		input(QUERY, "inbox");
		yield* Effect.promise(() => eventually(() => expect(readText("strong", rows()[0])).toBe("Build the inbox")));
		expect(readText("code", rows()[0])).toBe("task.triage");
		expect(readText("small", rows()[0])).toContain("task");
		expect(readText("[data-status-token]", rows()[0])).toBe("active");
		expect(readText("#search-dialog", document)).not.toContain("Inbox decision");
		input(QUERY, "records: inbox");
		yield* Effect.promise(() => eventually(() => expect(rows().some((row) => readText("strong", row) === "Inbox decision 9")).toBe(true)));
		expect(readText("strong", rows()[0])).toBe("Build the inbox");
		expect(
			new Set(
				rows()
					.map((row) => readText("code", row))
					.filter((id) => id?.startsWith("decision.delivery.")),
			).size,
		).toBe(10);
		expect(readText("#search-dialog", document)).not.toContain("Not recorded");
		for (const row of rows()) {
			expect(readText("p", row) ?? "").not.toMatch(/^(?:\{|---)|(?:id|kind|next_action):/u);
		}
		input(QUERY, "workspace");
		yield* Effect.promise(() => eventually(() => expect(readText("strong", rows()[0])).toBe("Go to A calmer workspace")));
		expect(rows().findIndex((row) => readText("strong", row) === "A calmer workspace")).toBeGreaterThan(0);
		for (const query of ["project.workspace", "calmer"]) {
			input(QUERY, query);
			yield* Effect.promise(() => eventually(() => expect(readText("strong", rows()[0])).toBe("Go to A calmer workspace")));
			const destinations = rows().map((row) => row.querySelector("a")?.getAttribute("href"));
			expect(new Set(destinations).size).toBe(destinations.length);
			expect(destinations.filter((href) => href === "/_board/item/project.workspace/")).toHaveLength(1);
		}
		input(QUERY, "Library");
		yield* Effect.promise(() => eventually(() => expect(rows()[0]?.querySelector("a")?.getAttribute("href")).toBe("/_board/library")));
		input(QUERY, "theme");
		yield* Effect.promise(() => eventually(() => expect(rows()[0]?.dataset.command).toBe("theme")));
		const address = window.location.href;
		click(rows()[0]?.querySelector("a"));
		expect(readRootAttribute("data-theme")).toBe("dark");
		expect(window.location.href).toBe(address);
	},
);
