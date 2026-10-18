import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, projectFiles, readerAt } from "#test/boardStory.ts";
import { fleetReports, fleetUnreachable } from "#test/fleetTraits.ts";
import { fleetWorkspace, fleetWorkspaceReports } from "#test/fleetWorkspaceFixture.ts";
import { waitFor } from "#test/live.ts";

boardStory.it(
	"counts what needs you on System by the same rule and label as Today, not by Fleet's own waiting count",
	[projectFiles(fleetWorkspace), fleetReports(fleetWorkspaceReports, { automation: 2, maintainer: 1, orchestrator: 0 }), readerAt("/_board/system")],
	function* ({ page, reader }) {
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("[data-needs-you] strong")?.textContent).toBe("3")));
		expect(page.document.querySelector("[data-needs-you] dt")?.textContent).toBe("Needs you");
		expect(page.document.getElementById("doc")?.textContent).not.toContain("Waiting on maintainer");
		const today = yield* reader.open("/");
		yield* Effect.promise(() => waitFor(() => expect(today.document.querySelector(".today-strip a")?.textContent).toBe("3 need you")));
		expect(today.document.querySelectorAll('ul[aria-label="Needs you"] > li')).toHaveLength(3);
	},
);

boardStory.it(
	"says Fleet is unavailable on Today instead of showing an unknown in-progress count",
	[projectFiles(fleetWorkspace), fleetUnreachable()],
	function* ({ page }) {
		function strip() {
			return [...page.document.querySelectorAll(".today-strip a")].map((link) => link.textContent);
		}
		yield* Effect.promise(() => waitFor(() => expect(strip()[1]).toBe("Fleet unavailable")));
		expect(strip()[0]).toBe("3 need you");
		expect(page.document.querySelector(".today-strip")?.textContent).not.toContain("?");
	},
);

boardStory.it(
	"names every workspace destination and the counts beside them",
	[projectFiles(fleetWorkspace), fleetUnreachable()],
	function* ({ page }) {
		function names() {
			return [...page.document.querySelectorAll("#primary-navigation a")].map((link) => link.getAttribute("aria-label"));
		}
		yield* Effect.promise(() => waitFor(() => expect(names()).toEqual(["Today, 3 need you", "Goals", "Now, 4 open tasks", "Library", "System"])));
		expect(page.document.getElementById("inbox-topbar")?.getAttribute("aria-label")).toBe("Today, 3 need you");
		expect(page.document.getElementById("inbox-count")?.getAttribute("aria-label")).toBe("3 need you");
	},
);
