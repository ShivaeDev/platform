import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenFleet, todayScreen } from "#test/screenWorkspaceTraits.ts";
import { todayFleetFixture } from "#test/todayFleetFixture.ts";

expectNoReactWarnings();

screenStory.it(
	"opens Today with the exact human lane and one honest card per goal, retaining Workspace notes",
	[todayScreen(), screenFleet(todayFleetFixture()), openScreen()],
	function* ({ openDetails, readInbox, readGoals, readText, readAttribute, findElements, findElement }) {
		yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe("Today")));
		expect(readAttribute('#primary-navigation [aria-current="page"]', "href")).toBe("/");
		const inbox = yield* Effect.promise(readInbox);
		const goals = yield* Effect.promise(readGoals);
		expect([...findElements("[data-attention-id]")].map((row) => row.getAttribute("data-attention-id"))).toEqual(inbox.you.map((item) => item.id));
		expect([...findElements("[data-goal-id]")].map((card) => card.getAttribute("data-goal-id"))).toEqual(goals.goals.map((goal) => goal.id));
		expect(findElements("[data-goal-next-action]")).toHaveLength(3);
		for (const goal of goals.goals) {
			const next = findElement(`[data-goal-id='${goal.id}'] [data-goal-next-action]`);
			if (goal.nextAction) {
				expect(next?.textContent).toBe(goal.nextAction);
				expect(next?.getAttribute("title")).toBe(goal.nextAction);
				expect(next?.classList.contains("line-clamp-2")).toBe(true);
			} else {
				expect(next).toBeNull();
			}
		}
		expect(readText(".today-strip")).toBe(`${inbox.you.length} need you·9 in progress·${goals.goals.length} active goals·2 files have problems`);
		expect([...findElements(".today-strip a")].map((link) => link.getAttribute("href"))).toEqual([
			"#needs-you",
			"#in-progress",
			"#today-goals",
			"/_board/system#source-problems",
		]);
		expect(readText("[data-goal-id='project.example']")).toContain("51 linked · 1 with evidence");
		expect(readText("[data-goal-id='project.empty']")).toContain("0 of 0 done");
		expect(readText("#today-goals")).not.toContain("not linked");
		expect(readText("#today-goals")).not.toContain("%");
		expect(readText("#doc")).not.toContain("Resolved elsewhere");
		expect(readText("#doc")).not.toContain("Parked");
		expect(findElements("[data-progress-id]")).toHaveLength(8);
		expect(readText("#in-progress a[href='/_board/work']")).toBe("All in Now →");
		const criteria = [...findElements<HTMLDetailsElement>(".today-goal details")];
		expect(criteria).toHaveLength(goals.goals.length);
		expect(criteria.every((entry) => !entry.open)).toBe(true);
		openDetails(criteria[0]);
		expect(criteria[0]?.open).toBe(true);
		expect([...findElements(".today-grid h2")].map((node) => node.textContent)).toEqual(["Needs you", "In progress", "Goals"]);
		expect(findElement("#needs-you")?.nextElementSibling?.id).toBe("in-progress");
		expect(findElement("#needs-you")?.parentElement).not.toBe(findElement("#today-goals")?.parentElement);
		expect(readText(".today-page a[href='/home.md']")).toBe("Workspace notes");
	},
);
