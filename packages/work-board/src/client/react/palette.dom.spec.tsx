import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { paletteFixture } from "#test/paletteFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { searchScreen } from "#test/searchScreen.tsx";

expectNoReactWarnings();

screenStory.it(
	"offers go-to views and open goals, ranks a matching command first and shows work metadata",
	[searchScreen(paletteFixture())],
	function* ({ readRootAttribute, input, click, findElements, readText }) {
		function rows() {
			return findElements<HTMLAnchorElement>('[role="option"]');
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
					?.getAttribute("href"),
			).toBe(href);
		}
		expect(readText()).not.toContain("Go to Finished workspace");
		input("#search-query", "inbox");
		yield* Effect.promise(() => eventually(() => expect(readText("strong", rows()[0])).toBe("Build the inbox")));
		expect(readText("code", rows()[0])).toBe("task.triage");
		expect(readText("small", rows()[0])).toContain("task");
		expect(readText("[data-status-token]", rows()[0])).toBe("active");
		expect(readText()).not.toContain("Inbox decision");
		input("#search-query", "records: inbox");
		yield* Effect.promise(() => eventually(() => expect(rows().some((row) => readText("strong", row) === "Inbox decision 9")).toBe(true)));
		expect(readText("strong", rows()[0])).toBe("Build the inbox");
		expect(
			new Set(
				rows()
					.map((row) => readText("code", row))
					.filter((id) => id?.startsWith("decision.delivery.")),
			).size,
		).toBe(10);
		expect(readText()).not.toContain("Not recorded");
		for (const row of rows()) {
			expect(readText("p", row) ?? "").not.toMatch(/^(?:\{|---)|(?:id|kind|next_action):/u);
		}
		input("#search-query", "workspace");
		yield* Effect.promise(() => eventually(() => expect(readText("strong", rows()[0])).toBe("Go to A calmer workspace")));
		expect(rows().findIndex((row) => readText("strong", row) === "A calmer workspace")).toBeGreaterThan(0);
		for (const query of ["project.workspace", "calmer"]) {
			input("#search-query", query);
			yield* Effect.promise(() => eventually(() => expect(readText("strong", rows()[0])).toBe("Go to A calmer workspace")));
			const destinations = rows().map((row) => row.getAttribute("href"));
			expect(new Set(destinations).size).toBe(destinations.length);
			expect(destinations.filter((href) => href === "/_board/item/project.workspace/")).toHaveLength(1);
		}
		input("#search-query", "Library");
		yield* Effect.promise(() => eventually(() => expect(rows()[0]?.getAttribute("href")).toBe("/_board/library")));
		input("#search-query", "theme");
		yield* Effect.promise(() => eventually(() => expect(rows()[0]?.dataset.command).toBe("theme")));
		click(rows()[0]);
		expect(readRootAttribute("data-theme")).toBe("dark");
	},
);
