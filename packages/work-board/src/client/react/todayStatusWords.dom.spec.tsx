import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { fleetWorkspace } from "#test/fleetWorkspaceFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenFiles, screenRoute, todayScreen } from "#test/screenWorkspaceTraits.ts";
import { labelledCombobox } from "#test/workScreens.ts";

expectNoReactWarnings();

screenStory.it(
	"leaves status chips off Today rows whose heading already names their state, keeping their age",
	[todayScreen(), openScreen()],
	function* ({ findElements, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElements("ul[aria-label='Needs you'] > li").length).toBeGreaterThan(0)));
		expect(findElements(".today-row [data-status-token]")).toHaveLength(0);
		for (const row of findElements("ul[aria-label='Needs you'] > li")) {
			expect(readText(".tabular-nums", row)).not.toBe("");
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
	function* ({ click, findElement, findElements, readText }) {
		function status() {
			return labelledCombobox(findElements("main [role='combobox']"), "Status");
		}
		function options() {
			return findElements(`#${CSS.escape(status()?.getAttribute("aria-controls") ?? "")} [role="option"]`, document);
		}
		yield* Effect.promise(() => eventually(() => expect(status()).toBeDefined()));
		click(status());
		click(options().find((option) => option.textContent === "Needs you"));
		yield* Effect.promise(() =>
			eventually(() =>
				expect(new URL(findElement<HTMLElement>("#doc")?.dataset.route ?? "", "http://board").searchParams.get("status")).toBe("value:needs-human"),
			),
		);
		yield* Effect.promise(() => eventually(() => expect(readText("[data-slot='select-value']", status())).toBe("Needs you")));
		click(status());
		expect(options().map((option) => option.textContent)).toEqual(["All statuses", "Active", "Needs you", "Planned"]);
	},
);

const BOTH_SPELLINGS = {
	...fleetWorkspace,
	"tasks/review.md":
		"---\nid: task.review\nkind: task\nstatus: needs-you\nowner: maintainer\nnext_action: Review the copy.\n---\n# Review the landing copy\n",
};

screenStory.it(
	"offers one Library status option for spellings that share a name and lists items of each",
	[screenFiles(BOTH_SPELLINGS, { home: "home.md" }), screenRoute("/_board/library"), openScreen()],
	function* ({ chooseOption, click, findElements, readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText("main")).toContain("Review the landing copy")));
		const status = findElements("main [role='combobox']").find(
			(trigger) => document.querySelector(`label[for="${trigger.id}"]`)?.textContent === "Status",
		);
		yield* Effect.promise(() => chooseOption(status, "Needs you"));
		yield* Effect.promise(() =>
			eventually(() =>
				expect(findElements("main li a").map((link) => link.textContent)).toEqual(["Review the landing copy", "Ship the onboarding email"]),
			),
		);
		click(status);
		const options = findElements(`#${CSS.escape(status?.getAttribute("aria-controls") ?? "")} [role="option"]`, document).map(
			(option) => option.textContent,
		);
		expect(options).toEqual(["All", "Active", "Needs you", "Planned"]);
	},
);

screenStory.it(
	"offers one All work status option for spellings that share a name and lists items of each",
	[screenFiles(BOTH_SPELLINGS, { home: "home.md" }), screenRoute("/_board/work?view=board&status=value%3Aneeds-you"), openScreen()],
	function* ({ click, findElements, readText }) {
		function status() {
			return labelledCombobox(findElements("main [role='combobox']"), "Status");
		}
		yield* Effect.promise(() => eventually(() => expect(status()).toBeDefined()));
		expect(readText("[data-slot='select-value']", status())).toBe("Needs you");
		click(status());
		expect(
			findElements(`#${CSS.escape(status()?.getAttribute("aria-controls") ?? "")} [role="option"]`, document).map((option) => option.textContent),
		).toEqual(["All statuses", "Active", "Needs you", "Planned"]);
		expect(readText("main")).toContain("Review the landing copy");
		expect(readText("main")).toContain("Ship the onboarding email");
		expect(readText("main")).not.toContain("Write the install guide");
	},
);

screenStory.it(
	"gives All work one column per status name holding items of each spelling",
	[screenFiles(BOTH_SPELLINGS, { home: "home.md" }), screenRoute("/_board/work?view=board"), openScreen()],
	function* ({ findByRole, findElements, readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText("main")).toContain("Review the landing copy")));
		expect(findElements(".work-column > h2 [data-status-token]").map((chip) => chip.textContent)).toEqual(["Planned", "Active", "Needs you"]);
		const needsYou = findByRole("region", "Needs you");
		expect(readText("h2", needsYou)).toBe("Needs you2");
		expect(needsYou?.textContent).toContain("Review the landing copy");
		expect(needsYou?.textContent).toContain("Ship the onboarding email");
	},
);
