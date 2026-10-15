import { expect, it } from "vitest";
import { render } from "@shivaedev/effect-react/testing.ts";
import { nowWork } from "#test/nowWork.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { WorkNow } from "./WorkNow.tsx";

it.each([
	["prepared", "Queued"],
	["needs-human", "Waiting on a person"],
	["adopting", "Executing"],
	["executing", "Executing"],
	["reviewing", "Reviewing"],
	["repairing", "Reviewing"],
	["validating", "Reviewing"],
	["delivering", "Delivering"],
] as const)("keeps Fleet %s visible in %s despite inactive authored statuses", async (stage, lane) => {
	const data = nowWork();
	const statuses = ["done", "completed", "superseded", "deferred", "cancelled", "canceled"];
	const rows = data.rows.map((item, index) => ({ ...item, metadata: { ...item.metadata, status: statuses[index] } }));
	const items = rows.map((item) => ({ document: null, stage, stageEnteredAt: null, updatedAt: null, workId: item.id }));
	const view = await render(
		<FleetItemsContext.Provider value={{ completed: [], items, state: "ready" }}>
			<WorkNow data={{ ...data, rows }} />
		</FleetItemsContext.Provider>,
	);
	try {
		const column = view.container.querySelector(`[aria-label="${lane}"]`);
		expect(column?.querySelectorAll(".work-card")).toHaveLength(statuses.length);
		for (const row of rows) {
			const card = column?.querySelector(`[data-item="${row.id}"]`);
			expect(card?.querySelector("h3")?.textContent).toBe(row.title);
			expect(card?.querySelectorAll("[data-status-token]")).toHaveLength(1);
			expect(card?.querySelector("[data-status-token]")?.textContent).toBe(stage === "needs-human" ? "needs-you" : stage);
		}
		expect(view.container.querySelector(".work-total")?.textContent).toContain("6 shown");
	} finally {
		await view.unmount();
	}
});
