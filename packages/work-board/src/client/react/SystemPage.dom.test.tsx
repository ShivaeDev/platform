import { Effect } from "effect";
import { expect } from "vitest";
import { screenStory } from "#test/screenStory.ts";
import { todayFleetFixture } from "#test/todayFleetFixture.ts";

screenStory.it("shows every running and waiting item by source title, stage and PR independently of health totals", [], function* ({ system }) {
	const fleet = todayFleetFixture();
	if (fleet.state !== "ready") {
		throw new Error("Missing Fleet fixture");
	}
	const view = yield* Effect.promise(() =>
		system({
			...fleet,
			items: fleet.items.map((item) => (item.stage === "needs-human" ? { ...item, attentionOwner: "maintainer" as const } : item)),
		}),
	);

	expect(view.container.querySelector("h1")?.textContent).toBe("System");
	expect(view.container.querySelector('[data-source="codex"]')).not.toBeNull();
	expect(view.container.querySelector('[data-source="github"]')).not.toBeNull();
	expect(view.container.querySelectorAll("[data-fleet-id]")).toHaveLength(13);
	expect(view.container.querySelector('[data-fleet-id="task.sample.0"]')?.textContent).toContain("Workspace task 0");
	expect(view.container.querySelector('[aria-label="Pull request for Workspace task 0"]')?.getAttribute("href")).toBe(
		"https://github.com/example/project/pull/1",
	);
	for (const stage of ["prepared", "executing", "adopting", "reviewing", "repairing", "validating", "delivering", "needs-human"]) {
		expect(view.container.querySelector('[aria-label="Fleet work"]')?.textContent).toContain(stage);
	}
	expect(view.container.querySelector('[data-fleet-id="task.needs-human"]')?.textContent).toContain("Waiting on maintainer");
	expect(view.container.querySelector('[data-fleet-id="task.released"]')).toBeNull();
});
screenStory.it("keeps an active Fleet row visible without a placeholder or link for its missing PR", [], function* ({ system, read }) {
	const fleet = todayFleetFixture();
	if (fleet.state !== "ready" || !fleet.items[0]) {
		throw new Error("Missing Fleet fixture");
	}
	const { prUrl, ...item } = fleet.items[0];
	const view = yield* Effect.promise(() => system({ ...fleet, items: [item] }));

	const row = view.container.querySelector('[data-fleet-id="task.sample.0"]');
	expect(row?.textContent).toContain("Workspace task 0");
	expect(row?.textContent).toContain("executing");
	expect(row?.querySelectorAll("a")).toHaveLength(1);
	expect(view.container.querySelector('[aria-label^="Pull request"]')).toBeNull();
	expect(read().text).not.toMatch(/not recorded/iu);
});
for (const fleet of [
	undefined,
	{ reason: "Daemon disconnected", state: "unavailable" } as const,
	{ completed: [], items: [], state: "ready" } as const,
]) {
	screenStory.it(`distinguishes loading, unavailable and empty Fleet data (${JSON.stringify(fleet)})`, [], function* ({ system }) {
		const view = yield* Effect.promise(() => system(fleet));

		const lane = view.container.querySelector('[aria-label="Fleet work"]');
		let message = "Loading Fleet work";
		if (fleet?.state === "ready") {
			message = "No running or waiting";
		}
		if (fleet?.state === "unavailable") {
			message = "Daemon disconnected";
		}
		expect(lane?.textContent).toContain(message);
		expect(lane?.querySelectorAll("[data-fleet-id]")).toHaveLength(0);
	});
}
