import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { fleetWorkspace } from "#test/fleetWorkspaceFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenFiles, screenRoute, todayScreen } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"leaves status chips off Today rows whose heading already names their state, keeping id, age and Answer",
	[todayScreen(), openScreen()],
	function* ({ findElement, findElements, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElements("ul[aria-label='Needs you'] > li").length).toBeGreaterThan(0)));
		expect(findElements(".today-row [data-status-token]")).toHaveLength(0);
		for (const row of findElements("ul[aria-label='Needs you'] > li")) {
			const id = row.dataset.attentionId ?? "";
			expect(readText(".font-mono", row)).toBe(id);
			expect(readText(".tabular-nums", row)).not.toBe("");
			expect(findElement("[aria-label^='Answer ']", row)?.textContent).toBe("Answer");
		}
		expect(readText("#needs-you")).not.toContain("needs-you");
	},
);

for (const [route, expected] of [
	["/_board/work?view=board", ["Planned", "Needs you", "Planned", "Active", "Active", "Needs you", "Needs you"]],
	["/_board/item/task.email/", ["Needs you"]],
	["/_board/item/task.upload/", ["Active"]],
] as const) {
	screenStory.it(
		`names each status in plain words at ${route}`,
		[screenFiles(fleetWorkspace, { home: "home.md" }), screenRoute(route), openScreen()],
		function* ({ findElements }) {
			yield* Effect.promise(() => eventually(() => expect(findElements("[data-status-token]").length).toBeGreaterThan(0)));
			const words = findElements("[data-status-token]").map((chip) => chip.textContent);
			expect(words).toEqual(expected);
		},
	);
}

screenStory.it(
	"names Library statuses in plain words in its rows and status filter",
	[screenFiles(fleetWorkspace, { home: "home.md" }), screenRoute("/_board/library"), openScreen()],
	function* ({ chooseOption, findElements, readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText("main")).toContain("Ship the onboarding email")));
		function rows() {
			return findElements("main li p").map((row) => row.textContent);
		}
		expect(rows()).toContain("task · Needs you");
		expect(rows()).toContain("task · Active");
		expect(readText("main")).not.toMatch(/needs-human|needs-you/u);
		const status = findElements("main [role='combobox']").find(
			(trigger) => document.querySelector(`label[for="${trigger.id}"]`)?.textContent === "Status",
		);
		yield* Effect.promise(() => chooseOption(status, "Needs you"));
		yield* Effect.promise(() => eventually(() => expect(rows()).toEqual(["task · Needs you"])));
	},
);

screenStory.it(
	"names statuses in plain words in the All work status filter",
	[screenFiles(fleetWorkspace, { home: "home.md" }), screenRoute("/_board/work?view=board"), openScreen()],
	function* ({ findElements }) {
		yield* Effect.promise(() => eventually(() => expect(findElements("select[name='status'] option").length).toBeGreaterThan(1)));
		expect(findElements<HTMLOptionElement>("select[name='status'] option").map((option) => [option.value, option.textContent])).toEqual([
			["", "All statuses"],
			["value:active", "Active"],
			["value:needs-human", "Needs you"],
			["value:planned", "Planned"],
		]);
	},
);
