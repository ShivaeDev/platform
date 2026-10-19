import { expect } from "vitest";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { todayFleetFixture } from "#test/todayFleetFixture.ts";
import { TodayProgress } from "./TodayProgress.tsx";

screenStory.it(
	"caps Fleet-held work at eight rows with stages, titles, PR links and a Now link",
	[componentScreen(<TodayProgress data={todayFleetFixture()} failed={false} />)],
	({ findElements, readText, readAttribute }) => {
		expect([...findElements("[data-progress-id]")].map((row) => row.getAttribute("data-progress-id"))).toEqual(
			Array.from({ length: 8 }, (_, index) => `task.sample.${index}`),
		);
		for (const stage of ["executing", "reviewing", "repairing", "adopting"]) {
			expect(readText()).toContain(`Fleet · ${stage}`);
		}
		expect(readText("[data-progress-id] a")).toBe("Workspace task 0");
		expect(readAttribute('a[aria-label="Pull request for Workspace task 0"]', "href")).toBe("https://github.com/example/project/pull/1");
		expect(readText('a[href="/_board/work"]')).toBe("All in Now →");
	},
);

const UNANSWERED = "Fleet on port 3457 didn't answer as expected, so agent work and its health are unknown.";
for (const [data, status] of [
	[undefined, "Fleet work unavailable."],
	[{ reason: UNANSWERED, state: "unavailable" }, UNANSWERED],
] as const) {
	screenStory.it(
		`reports unavailable Fleet work instead of an empty list: ${status}`,
		[componentScreen(<TodayProgress data={data} failed />)],
		({ readText, findElements }) => {
			expect(readText('[role="status"]')).toBe(status);
			expect(findElements("[data-progress-id]")).toHaveLength(0);
			expect(readText()).not.toContain("holds no work");
		},
	);
}

const data = todayFleetFixture();
if (data.state !== "ready" || !data.items[0]) {
	throw new Error("Missing held work");
}
const { prUrl, ...item } = data.items[0];
screenStory.it(
	"keeps held work visible when its source or PR is missing and reports retained refresh failure",
	[componentScreen(<TodayProgress data={{ ...data, items: [{ ...item, document: null }] }} failed />)],
	({ readText, findElement }) => {
		expect(readText("[data-progress-id] a")).toBe("task.sample.0");
		expect(findElement('[aria-label^="Pull request"]')).toBeNull();
		expect(readText()).not.toMatch(/not recorded/iu);
		expect(readText('[role="status"]')).toContain("Displayed work is retained");
	},
);

for (const ready of [false, true]) {
	const progress = ready ? { completed: [], items: [], state: "ready" as const } : undefined;
	screenStory.it(
		`distinguishes loading Fleet work from an available empty list (${ready})`,
		[componentScreen(<TodayProgress data={progress} failed={false} />)],
		({ readText, findElement, findElements }) => {
			if (ready) {
				expect(readText('[data-slot="empty-title"]')).toBe("No work in progress");
				expect(findElement("[data-loading]")).toBeNull();
			} else {
				expect(readText('[role="status"][aria-busy="true"]')).toBe("Loading work in progress");
				expect(findElements('[data-loading] [data-slot="skeleton"]').length).toBeGreaterThan(0);
				expect(findElement('[data-slot="empty"]')).toBeNull();
			}
			expect(findElement('a[href="/_board/work"]')).not.toBeNull();
		},
	);
}
