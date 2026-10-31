import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { itemOpened } from "#test/itemContextTraits.tsx";
import { itemPolishFixture } from "#test/itemPolishFixture.ts";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();

for (const evidence of [false, true]) {
	const summary = `${evidence ? 1 : 0} of 2 criteria have recorded evidence`;
	screenStory.it(`a done task says once that ${summary}`, [itemOpened(itemPolishFixture(evidence), "/done.md")], function* ({ evidenceSummaries }) {
		expect(yield* evidenceSummaries()).toEqual([summary]);
	});
}

screenStory.it(
	"a criterion with recorded evidence links the report that records its claim",
	[itemOpened(itemPolishFixture(true), "/done.md")],
	function* ({ criterionEvidence }) {
		expect(yield* criterionEvidence("layout")).toEqual({ claims: "1 recorded claim:", links: ["/_board/item/report.review/#recorded-evidence-0"] });
	},
);

screenStory.it(
	"a criterion without recorded evidence links no report",
	[itemOpened(itemPolishFixture(false), "/done.md")],
	function* ({ criterionEvidence }) {
		expect(yield* criterionEvidence("layout")).toBe("none");
	},
);

screenStory.it(
	"an unknown frontmatter field is listed as a metadata problem, and Fleet's own fleet field is not",
	[itemOpened(itemPolishFixture(), "/draft.md")],
	function* ({ metadataProblems }) {
		expect(yield* metadataProblems()).toEqual([expect.stringContaining("Unknown field flavor")]);
	},
);

screenStory.it(
	"a task whose only extra field is Fleet's fleet field lists no metadata problems",
	[itemOpened(itemPolishFixture(), "/done.md")],
	function* ({ metadataProblems }) {
		expect(yield* metadataProblems()).toEqual([]);
	},
);
