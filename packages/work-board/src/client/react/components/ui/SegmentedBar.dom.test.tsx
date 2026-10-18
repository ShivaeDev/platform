import { expect } from "vitest";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { SegmentedBar } from "./SegmentedBar.tsx";

screenStory.it(
	"renders three colored segments and written counts in the large goal bar, including zero",
	[componentScreen(<SegmentedBar counts={{ done: 2, "in progress": 0, planned: 1 }} label="Goal progress" size="large" />)],
	({ findElements }) => {
		const segments = findElements("[data-count]");
		expect([...segments].map((segment) => segment.getAttribute("data-count"))).toEqual(["2", "0", "1"]);
		for (const [index, color] of ["bg-done", "bg-agent-working", "bg-deferred"].entries()) {
			expect(segments[index]?.classList.contains(color)).toBe(true);
			expect(segments[index]?.classList.contains("border-r")).toBe(true);
		}
		expect([...findElements("li")].map((entry) => entry.textContent)).toEqual(["2 done", "0 in progress", "1 planned"]);
	},
);
