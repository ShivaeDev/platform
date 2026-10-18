import { act } from "react";
import { expect, it } from "vitest";
import { render } from "@shivaedev/effect-react/client/testing.ts";
import { nowFleet, nowWork } from "#test/nowWork.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { WorkCards } from "./WorkCards.tsx";
import { WorkNow } from "./WorkNow.tsx";
import { WorkTable } from "./WorkTable.tsx";

it.each([WorkNow, WorkCards, WorkTable])("bounds 1,500 rendered rows and scrolls to later work", async (View) => {
	const data = nowWork(1500);
	const view = await render(
		<FleetItemsContext.Provider value={nowFleet(1500)}>
			<View data={data} />
		</FleetItemsContext.Provider>,
	);
	try {
		expect(view.container.querySelectorAll("[data-item]").length).toBeLessThan(300);
		const list = view.container.querySelector<HTMLDivElement>(View === WorkTable ? ".work-table-wrap" : ".work-card-list");
		expect(list).not.toBeNull();
		const before = list?.querySelector("[data-item]")?.getAttribute("data-item");
		act(() => {
			if (list) {
				list.scrollTop = 22_400;
				list.dispatchEvent(new Event("scroll", { bubbles: true }));
			}
		});
		expect(list?.querySelector("[data-item]")?.getAttribute("data-item")).not.toBe(before);
		expect(view.container.querySelectorAll("[data-item]").length).toBeLessThan(300);
	} finally {
		await view.unmount();
	}
});
