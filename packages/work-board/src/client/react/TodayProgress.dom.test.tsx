import { Effect } from "effect";
import { expect } from "vitest";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { todayFleetFixture } from "#test/todayFleetFixture.ts";
import { TodayProgress } from "./TodayProgress.tsx";

screenStory.it(
	"caps Fleet-held work at eight rows with stages, titles, PR links and a Now link",
	[componentScreen(<TodayProgress data={todayFleetFixture()} failed={false} />)],
	({ screen }) => {
		const view = screen();

		expect([...view.container.querySelectorAll("[data-progress-id]")].map((row) => row.getAttribute("data-progress-id"))).toEqual(
			Array.from({ length: 8 }, (_, index) => `task.sample.${index}`),
		);
		for (const stage of ["executing", "reviewing", "repairing", "adopting"]) {
			expect(view.container.textContent).toContain(`Fleet · ${stage}`);
		}
		expect(view.container.querySelector("[data-progress-id] a")?.textContent).toBe("Workspace task 0");
		expect(view.container.querySelector('a[aria-label="Pull request for Workspace task 0"]')?.getAttribute("href")).toBe(
			"https://github.com/example/project/pull/1",
		);
		expect(view.container.querySelector('a[href="/_board/work"]')?.textContent).toBe("All in Now →");
	},
);

for (const [storyCase, data] of [undefined, { reason: "Daemon disconnected", state: "unavailable" } as const].entries()) {
	screenStory.it(
		`reports unavailable Fleet work instead of an empty list (${storyCase + 1})`,
		[componentScreen(<TodayProgress data={data} failed />)],
		({ screen }) => {
			const view = screen();

			expect(view.container.querySelector('[role="status"]')?.textContent).toContain("unavailable");
			expect(view.container.querySelectorAll("[data-progress-id]")).toHaveLength(0);
			expect(view.container.textContent).not.toContain("holds no work");
		},
	);
}

screenStory.it("keeps held work visible when its source or PR is missing and reports retained refresh failure", [], function* ({ render }) {
	const data = todayFleetFixture();
	if (data.state !== "ready" || !data.items[0]) {
		throw new Error("Missing held work");
	}
	const { prUrl, ...item } = data.items[0];
	const view = yield* Effect.promise(() => render(<TodayProgress data={{ ...data, items: [{ ...item, document: null }] }} failed />));

	expect(view.container.querySelector("[data-progress-id] a")?.textContent).toBe("task.sample.0");
	expect(view.container.querySelector('[aria-label^="Pull request"]')).toBeNull();
	expect(view.container.textContent).not.toMatch(/not recorded/iu);
	expect(view.container.querySelector('[role="status"]')?.textContent).toContain("Displayed work is retained");
});

for (const ready of [false, true]) {
	screenStory.it(`distinguishes loading Fleet work from an available empty list (${ready})`, [], function* ({ render }) {
		const data = ready ? { completed: [], items: [], state: "ready" as const } : undefined;
		const view = yield* Effect.promise(() => render(<TodayProgress data={data} failed={false} />));

		expect(view.container.textContent).toContain(ready ? "Fleet holds no work" : "Loading Fleet work");
		expect(view.container.querySelector('a[href="/_board/work"]')).not.toBeNull();
	});
}
