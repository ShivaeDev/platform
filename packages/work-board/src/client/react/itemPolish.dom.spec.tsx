import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { itemPolishFixture } from "#test/itemPolishFixture.ts";
import { QueryDocument } from "#test/QueryDocument.tsx";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";

for (const evidence of [false, true]) {
	screenStory.it(
		`summarizes criterion evidence once and retains recorded claims (evidence: ${evidence})`,
		[boardScreen(itemPolishFixture(evidence), (api) => <QueryDocument api={api} url="/done.md" />)],
		function* ({ findElement, findElements, readText, readAttribute }) {
			yield* Effect.promise(() => eventually(() => expect(findElement("#criterion-layout")).not.toBeNull()));
			const summary = `${evidence ? 1 : 0} of 2 criteria have recorded evidence`;
			expect(
				findElements("p")
					.filter((p) => p.textContent === summary)
					.map((p) => p.textContent),
			).toEqual([summary]);
			expect(readText()).not.toContain("No recorded evidence");
			expect(readText()).not.toContain("Acceptance is not established");
			expect(findElement("#criterion-links p")).toBeNull();
			if (evidence) {
				expect(readAttribute("#criterion-layout a", "href")).toBe("/_board/item/report.review/#recorded-evidence-0");
				expect(readText("#criterion-layout")).toContain("1 recorded claim:");
			} else {
				expect(findElement("#criterion-layout a")).toBeNull();
			}
			expect(readText(".item-introduction [data-status-token]")).toBe("Done");
			expect(findElement('a[href="https://github.com/ShivaeDev/platform/pull/390"]')).not.toBeNull();
		},
	);
}

for (const file of ["done", "draft", "goal"]) {
	screenStory.it(
		`keeps owned fields quiet and unowned fields visible on ${file}`,
		[boardScreen(itemPolishFixture(), (api) => <QueryDocument api={api} url={`/${file}.md`} />)],
		function* ({ findElement, readText, findElements }) {
			yield* Effect.promise(() => eventually(() => expect(findElement("#criterion-layout")).not.toBeNull()));
			expect(readText()).toContain("0 of 2 criteria have recorded evidence");
			expect(readText()).not.toContain("Unknown field fleet");
			const diagnostics = findElement(".metadata-problems");
			if (file === "draft") {
				expect(findElements("li", diagnostics).map((item) => item.textContent)).toEqual([expect.stringContaining("Unknown field flavor")]);
			} else {
				expect(diagnostics).toBeNull();
			}
		},
	);
}
