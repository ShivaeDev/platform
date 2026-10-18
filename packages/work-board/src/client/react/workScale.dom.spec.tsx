import { act } from "react";
import { expect } from "vitest";
import { nowScreen } from "#test/nowScreen.tsx";
import { screenStory } from "#test/screenStory.ts";
import { WorkCards } from "./WorkCards.tsx";
import { WorkNow } from "./WorkNow.tsx";
import { WorkTable } from "./WorkTable.tsx";

for (const [storyCase, View] of [WorkNow, WorkCards, WorkTable].entries()) {
	screenStory.it(`bounds 1,500 rendered rows and scrolls to later work (${storyCase + 1})`, [nowScreen(1500, View)], ({ screen }) => {
		const view = screen();

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
	});
}
