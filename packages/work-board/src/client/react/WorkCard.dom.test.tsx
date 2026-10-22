import { expect } from "vitest";
import { orchestratorWorkCard } from "#test/orchestratorWorkCard.tsx";
import { screenStory } from "#test/screenStory.ts";

screenStory.it("shows the orchestrator holder and hides missing PR and stage time", [orchestratorWorkCard()], ({ readText, count, findElement }) => {
	expect(readText(".work-owner")).toBe("Waiting on orchestrator");
	expect(readText()).not.toContain("PR not recorded");
	expect(count("[data-status-token]")).toBe(1);
	expect(readText("[data-status-token]")).toBe("Working");
	expect(findElement(".work-stage")).toBeNull();
});
