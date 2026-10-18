import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, projectFiles, readerAt } from "#test/boardStory.ts";
import { fleetReports } from "#test/fleetTraits.ts";
import { fleetWorkspace, fleetWorkspaceReports } from "#test/fleetWorkspaceFixture.ts";
import { waitFor } from "#test/live.ts";

boardStory.it(
	"says in plain words who holds each Now card and how long it has been in its stage",
	[projectFiles(fleetWorkspace), fleetReports(fleetWorkspaceReports), readerAt("/_board/work")],
	function* ({ page }) {
		function card(id: string) {
			const found = page.document.querySelector(`[data-item="${id}"]`);
			return { owner: found?.querySelector(".work-owner")?.textContent, stage: found?.querySelector(".work-stage")?.textContent };
		}
		yield* Effect.promise(() => waitFor(() => expect(card("task.upload")).toEqual({ owner: "Fleet is working on this", stage: "Executing for 4h" })));
		expect(card("task.guide")).toEqual({ owner: "Queued for Fleet", stage: "Queued for 4h" });
		expect(card("task.email")).toEqual({ owner: "Needs you", stage: "Waiting for 4h" });
		expect(card("task.pricing")).toEqual({ owner: "Assigned to you", stage: undefined });
		expect(page.document.querySelectorAll(".work-now .work-kind")).toHaveLength(0);
	},
);
