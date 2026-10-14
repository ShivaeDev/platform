import { expect, it } from "vitest";
import { render } from "@shivaedev/effect-react/testing.ts";
import { nowFleet, nowWork } from "#test/nowWork.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { WorkCard } from "./WorkCard.tsx";
import { WorkNow } from "./WorkNow.tsx";
import { WorkPage } from "./WorkPage.tsx";

it.each([true, false])("keeps goals and projects outside Now with Fleet ready=%s", async (ready) => {
	const data = nowWork(3);
	const rows = data.rows.map((item, index) => ({
		...item,
		metadata: { ...item.metadata, kind: (["goal", "project", "task"] as const)[index], status: "active" },
	}));
	const view = await render(
		<FleetItemsContext.Provider value={ready ? nowFleet(3) : undefined}>
			<WorkNow data={{ ...data, rows }} />
		</FleetItemsContext.Provider>,
	);
	try {
		expect([...view.container.querySelectorAll("[data-item]")].map((card) => card.getAttribute("data-item"))).toEqual(["task-2"]);
	} finally {
		await view.unmount();
	}
});

it.each(["prepared", "needs-human"] as const)("excludes inactive tasks despite Fleet %s", async (stage) => {
	const data = nowWork(8);
	const statuses = ["superseded", "deferred", "done", "cancelled", "canceled", "completed", "planned", "active"];
	const rows = data.rows.map((item, index) => ({ ...item, metadata: { ...item.metadata, status: statuses[index] } }));
	const fleet = nowFleet(8);
	if (fleet.state !== "ready") {
		throw new Error("Missing Fleet fixture");
	}
	const items = rows.map((item) => ({ document: null, stage, stageEnteredAt: null, updatedAt: null, workId: item.id }));
	const view = await render(
		<FleetItemsContext.Provider value={{ ...fleet, completed: [], items }}>
			<WorkNow data={{ ...data, rows }} />
		</FleetItemsContext.Provider>,
	);
	try {
		expect([...view.container.querySelectorAll("[data-item]")].map((card) => card.getAttribute("data-item"))).toEqual(["task-6", "task-7"]);
	} finally {
		await view.unmount();
	}
});

it("queues only approved waiting tasks without a Fleet item", async () => {
	const data = nowWork(5);
	const statuses = ["planned", undefined, "unknown", "approved", "planned"];
	const rows = data.rows.map((item, index) => ({ ...item, fleetApproved: index === 4, metadata: { ...item.metadata, status: statuses[index] } }));
	const view = await render(<WorkNow data={{ ...data, rows }} />);
	try {
		expect([...view.container.querySelectorAll('[aria-label="Queued"] [data-item]')].map((card) => card.getAttribute("data-item"))).toEqual([
			"task-3",
			"task-4",
		]);
	} finally {
		await view.unmount();
	}
});

it.each([undefined, "needs-human", "reviewing"] as const)("hides absent card facts and renders one state with Fleet %s", async (stage) => {
	const data = nowWork(1);
	const item = data.rows[0];
	if (!item) {
		throw new Error("Missing work fixture");
	}
	const fleet = stage ? { document: null, stage, stageEnteredAt: null, updatedAt: null, workId: item.id } : undefined;
	const view = await render(
		<WorkCard fleet={fleet} item={{ ...item, metadata: { kind: "task", status: "planned" }, waiting: "Review needed" }} state={data.state} />,
	);
	try {
		expect(view.container.querySelectorAll("[data-status-token]")).toHaveLength(1);
		expect(view.container.querySelector("[data-status-token]")?.textContent).toBe(stage === "reviewing" ? "reviewing" : "needs-you");
		expect(view.container.textContent).not.toContain("PR not recorded");
		expect(view.container.textContent).not.toContain("Holder: Not recorded");
		expect(view.container.querySelector(".work-owner") === null).toBe(stage === undefined);
		expect(view.container.querySelector(".work-stage")).toBeNull();
		expect(view.container.querySelector("svg.lucide-git-pull-request")).toBeNull();
	} finally {
		await view.unmount();
	}
});

it("collapses saved views and filters behind Filter on Now", async () => {
	const view = await render(<WorkPage data={nowWork()} />);
	try {
		expect(view.container.querySelector(".work-options")).toHaveProperty("open", false);
		expect(view.container.querySelector(".work-options summary")?.textContent).toBe("Filter");
		expect(view.container.querySelector(".work-options #saved-work-views")).not.toBeNull();
		expect(view.container.querySelector(".work-options .work-filters")).not.toBeNull();
		expect(view.container.textContent).not.toContain("Cards retain their authored status");
		expect(view.container.textContent).not.toContain("completed items have no recent completion time");
	} finally {
		await view.unmount();
	}
});
