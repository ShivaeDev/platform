import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { fleetItemRankingFixture } from "#test/searchRankingFixture.ts";
import { searchScreen } from "#test/searchScreen.tsx";

expectNoReactWarnings();

const { files, modified } = fleetItemRankingFixture();
screenStory.it(
	"puts open body matches and done items before headings, includes Fleet status and reports only with records:, and keeps anchors unique",
	[searchScreen(files, { home: undefined, modified })],
	function* ({ findElements, findElement, readText, typeText }) {
		function rows() {
			return [...findElements<HTMLAnchorElement>('#search-dialog [role="option"] a', document)];
		}
		function type(query: string) {
			const field = findElement<HTMLInputElement>('#search-dialog [role="combobox"]', document);
			if (!field) {
				throw new Error("Missing palette input");
			}
			typeText(field, query);
		}

		for (const query of ["watch", "records: watch"]) {
			type(query);
			const records = query.startsWith("records:");
			yield* Effect.promise(() => eventually(() => expect(readText("code", rows()[0])).toBe(records ? "decision.watch" : "task.review")));
			const work = rows().filter((row) => readText("code", row)?.startsWith("task."));
			expect(work.slice(0, 2).map((row) => readText("strong", row))).toEqual(["Keep reviews visible", "Done watch"]);
			expect(work.slice(0, 2).map((row) => readText("[data-status-token]", row))).toEqual(["active", "done"]);
			expect(readText("p", work[0])).toBe("The watch keeps running.");
			expect(rows().some((row) => readText("strong", row) === "Watch notes")).toBe(true);
			const hrefs = rows().map((row) => row.getAttribute("href"));
			expect(new Set(hrefs).size).toBe(hrefs.length);
			const recordRows = rows().filter((row) => /(?:fleet\/status|responses\/fleet-report)/u.test(row.href));
			if (query.startsWith("records:")) {
				expect(
					rows()
						.slice(0, 4)
						.map((row) => readText("strong", row)),
				).toEqual(["Watch decision", "Review policy", "Keep reviews visible", "Done watch"]);
				expect(readText("p", rows()[1])).toBe("The watch needs a policy.");
				expect(recordRows.length).toBeGreaterThan(0);
				expect(hrefs.findIndex((href) => href?.startsWith("/responses/fleet-report."))).toBeGreaterThan(1);
				expect(hrefs.findIndex((href) => href?.startsWith("/fleet/status.md"))).toBeGreaterThan(1);
			} else {
				expect(recordRows).toEqual([]);
				expect(rows().some((row) => readText("code", row)?.startsWith("decision."))).toBe(false);
			}
			expect(readText("#search-dialog", document)).not.toContain("Not recorded");
			for (const row of rows()) {
				expect(readText("p", row) ?? "").not.toMatch(/^(?:\{|---)|(?:id|kind|status):/u);
			}
		}
	},
);
