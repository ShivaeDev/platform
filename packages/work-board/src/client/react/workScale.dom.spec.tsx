import { expect } from "vitest";
import { nowScreen } from "#test/nowScreen.tsx";
import { screenStory } from "#test/screenStory.ts";
import { WorkCards } from "./WorkCards.tsx";
import { WorkNow } from "./WorkNow.tsx";
import { WorkTable } from "./WorkTable.tsx";

for (const [storyCase, View] of [WorkNow, WorkCards, WorkTable].entries()) {
	screenStory.it(
		`bounds 1,500 rendered rows and scrolls to later work (${storyCase + 1})`,
		[nowScreen(1500, View)],
		({ scrollList, scrollPage, findElements, findElement, readAttribute }) => {
			expect(findElements("[data-item]").length).toBeLessThan(300);
			const list =
				View === WorkTable ? (findElement("[data-slot=table-container]")?.parentElement ?? null) : findElement<HTMLElement>(".work-card-list");
			expect(list).not.toBeNull();
			const before = readAttribute("[data-item]", "data-item", list);
			if (View === WorkNow) {
				scrollList(list, 22_400);
			} else {
				scrollPage(list, 22_400);
			}
			expect(readAttribute("[data-item]", "data-item", list)).not.toBe(before);
			expect(findElements("[data-item]").length).toBeLessThan(300);
		},
	);
}

screenStory.it("keeps a page-scrolled card list out of scroll anchoring", [nowScreen(1500, WorkCards)], ({ findElement }) => {
	expect(findElement(".work-card-list")?.className).toContain("[overflow-anchor:none]");
});
