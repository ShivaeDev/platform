import { expect } from "vitest";
import { screenStory } from "#test/screenStory.ts";
import { systemScreen } from "#test/screenTraits.ts";
import { todayFleetFixture } from "#test/todayFleetFixture.ts";

{
	const fleet = todayFleetFixture();
	if (fleet.state !== "ready") {
		throw new Error("Missing Fleet fixture");
	}
	screenStory.it(
		"shows every running and waiting item by source title, stage and PR independently of health totals",
		[
			systemScreen({
				...fleet,
				items: fleet.items.map((item) => (item.stage === "needs-human" ? { ...item, attentionOwner: "maintainer" as const } : item)),
			}),
		],
		({ readText, findElement, findElements, readAttribute }) => {
			expect(readText("h1")).toBe("System");
			expect(findElement('[data-source="codex"]')).not.toBeNull();
			expect(findElement('[data-source="github"]')).not.toBeNull();
			expect(findElements("[data-fleet-id]")).toHaveLength(13);
			expect(readText('[data-fleet-id="task.sample.0"]')).toContain("Workspace task 0");
			expect(readAttribute('[aria-label="Pull request for Workspace task 0"]', "href")).toBe("https://github.com/example/project/pull/1");
			for (const stage of ["prepared", "executing", "adopting", "reviewing", "repairing", "validating", "delivering", "needs-human"]) {
				expect(readText('[aria-label="Fleet work"]')).toContain(stage);
			}
			expect(readText('[data-fleet-id="task.needs-human"]')).toContain("Waiting on maintainer");
			expect(findElement('[data-fleet-id="task.released"]')).toBeNull();
		},
	);
}
{
	const fleet = todayFleetFixture();
	if (fleet.state !== "ready" || !fleet.items[0]) {
		throw new Error("Missing Fleet fixture");
	}
	const { prUrl, ...item } = fleet.items[0];
	screenStory.it(
		"keeps an active Fleet row visible without a placeholder or link for its missing PR",
		[systemScreen({ ...fleet, items: [item] })],
		({ read, findElement, findElements }) => {
			const row = findElement('[data-fleet-id="task.sample.0"]');
			expect(row?.textContent).toContain("Workspace task 0");
			expect(row?.textContent).toContain("executing");
			expect(findElements("a", row)).toHaveLength(1);
			expect(findElement('[aria-label^="Pull request"]')).toBeNull();
			expect(read().text).not.toMatch(/not recorded/iu);
		},
	);
}
for (const fleet of [
	undefined,
	{ reason: "Daemon disconnected", state: "unavailable" } as const,
	{ completed: [], items: [], state: "ready" } as const,
]) {
	screenStory.it(
		`distinguishes loading, unavailable and empty Fleet data (${JSON.stringify(fleet)})`,
		[systemScreen(fleet)],
		({ findElement, findElements }) => {
			const lane = findElement('[aria-label="Fleet work"]');
			let message = "Loading Fleet work";
			if (fleet?.state === "ready") {
				message = "No running or waiting";
			}
			if (fleet?.state === "unavailable") {
				message = "Daemon disconnected";
			}
			expect(lane?.textContent).toContain(message);
			expect(findElements("[data-fleet-id]", lane)).toHaveLength(0);
		},
	);
}
