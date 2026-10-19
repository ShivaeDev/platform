import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { goalsFixture } from "#test/goalsFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { goalsScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"shows linked criterion progress and next actions without zero-count metadata or untargeted criteria",
	[goalsScreen({ ...goalsFixture(), "claims.md": "" })],
	({ read, findElement, findElements, readText }) => {
		expect(read().text).not.toMatch(/0 linked|0 evidence|0 open|0 of 0|0\/0/u);
		const card = findElement('[data-goal-id="project.example"]');
		expect(card?.textContent).toContain("2 of 5 done");
		expect(card?.textContent).toContain("Review linked work");
		expect(card?.textContent).toContain("2 open asks");
		const criteria = findElements("li", card);
		expect([...(criteria ?? [])].map((row) => row.textContent)).toEqual(["First criterion1/2", "Second criterion0/1"]);
		expect(findElement('a[href="/_board/item/project.example/#criterion-first"]', card)).not.toBeNull();
		expect(read().text).not.toContain("No linked work");
		expect(readText('[data-goal-id="project.empty"]')).toBe("Empty goal");
	},
);

screenStory.it("keeps closed goals in one collapsed section after active goals", [goalsScreen()], ({ findElement, readText, findElements }) => {
	const closed = findElement<HTMLDetailsElement>("details");
	expect(closed).not.toBeNull();
	expect(closed?.open).toBe(false);
	expect(readText("summary", closed)).toBe("Closed goals");
	expect(readText('[data-goal-id="project.closed"]', closed)).toBe("Closed goal1 open ask");
	expect(findElements("[data-goal-id]", closed?.previousElementSibling)).toHaveLength(2);
});

screenStory.it("omits an empty closed section and keeps the empty active state", [goalsScreen({})], ({ findElement, readText }) => {
	expect(readText('[data-slot="empty-title"]')).toBe("No active goals");
	expect(readText('[data-slot="empty-description"]')).toBe("A goal appears here when a file in this workspace declares one.");
	expect(readText('[data-slot="empty"] a[href="/_board/start"]')).toBe("Getting started");
	expect(findElement("[data-page-summary]")).toBeNull();
	expect(findElement("details")).toBeNull();
});

screenStory.it(
	"aligns goal cards at the top and shows each goal's done share on the stock progress bar",
	[goalsScreen()],
	({ findElement, readAttribute }) => {
		const card = findElement('[data-goal-id="project.example"]');
		expect(card?.parentElement?.classList.contains("items-start")).toBe(true);
		expect(readAttribute('[role="progressbar"][data-slot="progress"]', "aria-valuetext", card)).toBe("2 of 5 done");
	},
);
