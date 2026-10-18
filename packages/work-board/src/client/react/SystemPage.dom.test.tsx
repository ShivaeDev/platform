import { expect, it } from "vitest";
import { render } from "@shivaedev/effect-react/client/testing.ts";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import type { DiagnosticsProjection } from "#browser/views/remaining.ts";
import { FleetItemsContext } from "#client/react/FleetItemsContext.ts";
import { SystemPage } from "#client/react/SystemPage.tsx";
import { todayFleetFixture } from "#test/todayFleetFixture.ts";

const missing = { cause: "Source missing", observedAt: 0, state: "not-configured" } as const;
const data: DiagnosticsProjection = { now: 0, sources: { codex: missing, fleet: missing, github: missing } };
function system(fleet: FleetItemsProjection | undefined) {
	return render(
		<FleetItemsContext.Provider value={fleet}>
			<SystemPage data={data} />
		</FleetItemsContext.Provider>,
	);
}
it("shows every running and waiting item by source title, stage and PR independently of health totals", async () => {
	const fleet = todayFleetFixture();
	if (fleet.state !== "ready") {
		throw new Error("Missing Fleet fixture");
	}
	const view = await system({
		...fleet,
		items: fleet.items.map((item) => (item.stage === "needs-human" ? { ...item, attentionOwner: "maintainer" as const } : item)),
	});
	try {
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
		expect(view.container.querySelector('[data-fleet-id="task.needs-human"]')?.textContent).toContain("Needs you");
		expect(view.container.querySelector('[data-fleet-id="task.released"]')).toBeNull();
	} finally {
		await view.unmount();
	}
});
it("keeps an active Fleet row visible without a placeholder or link for its missing PR", async () => {
	const fleet = todayFleetFixture();
	if (fleet.state !== "ready" || !fleet.items[0]) {
		throw new Error("Missing Fleet fixture");
	}
	const { prUrl, ...item } = fleet.items[0];
	const view = await system({ ...fleet, items: [item] });
	try {
		const row = view.container.querySelector('[data-fleet-id="task.sample.0"]');
		expect(row?.textContent).toContain("Workspace task 0");
		expect(row?.textContent).toContain("executing");
		expect(row?.querySelectorAll("a")).toHaveLength(1);
		expect(view.container.querySelector('[aria-label^="Pull request"]')).toBeNull();
		expect(view.container.textContent).not.toMatch(/not recorded/iu);
	} finally {
		await view.unmount();
	}
});
it.each([undefined, { reason: "Daemon disconnected", state: "unavailable" } as const, { completed: [], items: [], state: "ready" } as const])(
	"distinguishes loading, unavailable and empty Fleet data (%j)",
	async (fleet) => {
		const view = await system(fleet);
		try {
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
		} finally {
			await view.unmount();
		}
	},
);
