import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { failingSectionRender } from "#test/failingSectionRender.ts";
import { LONG_REPORT } from "#test/longReportFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

screenStory.it(
	"shows the route error when a later section of a long report fails to render",
	[failingSectionRender("Finding 1"), routedScreen({ "home.md": "# Home", "report.md": LONG_REPORT }, "/report.md")],
	function* ({ findElement, readText }) {
		yield* eventually(() => expect(readText("pre code")).toBe("Rendering failed on Finding 1"));
		expect(findElement("#heading-finding-1")).toBeNull();
	},
);
