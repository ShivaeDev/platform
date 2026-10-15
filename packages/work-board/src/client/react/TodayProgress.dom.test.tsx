import { expect, it } from "vitest";
import { render } from "@shivaedev/effect-react/testing.ts";
import { todayFleetFixture } from "#test/todayFleetFixture.ts";
import { TodayProgress } from "./TodayProgress.tsx";

it("caps Fleet-held work at eight rows with stages, titles, PR links and a Now link", async () => {
	const view = await render(<TodayProgress data={todayFleetFixture()} failed={false} />);
	try {
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
	} finally {
		await view.unmount();
	}
});

it.each([undefined, { reason: "Daemon disconnected", state: "unavailable" } as const])(
	"reports unavailable Fleet work instead of an empty list",
	async (data) => {
		const view = await render(<TodayProgress data={data} failed />);
		try {
			expect(view.container.querySelector('[role="status"]')?.textContent).toContain("unavailable");
			expect(view.container.querySelectorAll("[data-progress-id]")).toHaveLength(0);
			expect(view.container.textContent).not.toContain("holds no work");
		} finally {
			await view.unmount();
		}
	},
);

it("keeps held work visible when its source or PR is missing and reports retained refresh failure", async () => {
	const data = todayFleetFixture();
	if (data.state !== "ready" || !data.items[0]) {
		throw new Error("Missing held work");
	}
	const { prUrl, ...item } = data.items[0];
	const view = await render(<TodayProgress data={{ ...data, items: [{ ...item, document: null }] }} failed />);
	try {
		expect(view.container.querySelector("[data-progress-id] a")?.textContent).toBe("task.sample.0");
		expect(view.container.querySelector('[aria-label="Pull request not recorded"]')).not.toBeNull();
		expect(view.container.querySelector('[role="status"]')?.textContent).toContain("Displayed work is retained");
	} finally {
		await view.unmount();
	}
});

it.each([false, true])("distinguishes loading Fleet work from an available empty list (%s)", async (ready) => {
	const data = ready ? { completed: [], items: [], state: "ready" as const } : undefined;
	const view = await render(<TodayProgress data={data} failed={false} />);
	try {
		expect(view.container.textContent).toContain(ready ? "Fleet holds no work" : "Loading Fleet work");
		expect(view.container.querySelector('a[href="/_board/work"]')).not.toBeNull();
	} finally {
		await view.unmount();
	}
});
