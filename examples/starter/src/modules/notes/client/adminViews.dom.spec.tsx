import { expect } from "vitest";
import { eventually } from "@shivaedev/react/client/testing.ts";
import {
	adminScreen,
	adminScreens,
	countedNotes,
	failedJobs,
	heldHealth,
	retryRegistration,
	unavailableHealth,
} from "#modules/notes/test-support/admin/screens.tsx";

adminScreens.it("shows an empty failed list, health and counts", [adminScreen()], function* ({ screenContent }) {
	const content = yield* screenContent();
	yield* eventually(() => expect(content.textContent).toContain("No failed jobs."));
	expect(content.querySelector('[aria-label="Jobs health"]')?.textContent).toContain("Failed0");
	expect(content.querySelector('[aria-label="Queue counts"]')?.textContent).toContain("Total0");
	expect(content.querySelector('nav[aria-label="Administration"]')?.textContent).toContain("Note statistics");
});

adminScreens.it("shows loading until the health response arrives", [heldHealth, adminScreen()], function* ({ screenContent, releaseHealth }) {
	const content = yield* screenContent();
	yield* eventually(() => expect(content.querySelector('[aria-label="Jobs health"] [role="status"]')?.textContent).toBe("Loading…"));
	yield* releaseHealth();
	yield* eventually(() => expect(content.querySelector('[aria-label="Jobs health"]')?.textContent).toContain("Ready0"));
});

adminScreens.it("refreshes a failed health request", [unavailableHealth, adminScreen()], function* ({ screenContent, recoverHealth, clickControl }) {
	const content = yield* screenContent();
	yield* eventually(() => expect(content.querySelector('[aria-label="Jobs health"] [role="alert"]')?.textContent).toContain("Could not load"));
	yield* recoverHealth();
	yield* clickControl('[aria-label="Jobs health"] button');
	yield* eventually(() => expect(content.querySelector('[aria-label="Jobs health"]')?.textContent).toContain("Failed1"));
	expect(content.querySelector('[aria-label="Jobs health"] [role="alert"]')).toBeNull();
});

adminScreens.it(
	"paginates failed jobs and loads detail without a retry control for read-only registration",
	[failedJobs, adminScreen()],
	function* ({ screenContent, clickControl }) {
		const content = yield* screenContent();
		yield* eventually(() => expect(content.querySelector("tbody")?.textContent).toContain("first-job"));
		yield* clickControl("tbody button");
		yield* eventually(() => expect(content.querySelector('[aria-label="Job detail"]')?.textContent).toContain('"noteId": 42'));
		expect(content.querySelector('[aria-label="Job detail"]')?.textContent).toContain("Worker unavailable");
		expect([...content.querySelectorAll("button")].some((button) => button.textContent === "Retry job")).toBe(false);
		yield* clickControl({ name: "Next", role: "button" });
		yield* eventually(() => expect(content.querySelector("tbody")?.textContent).toContain("second-job"));
		expect(content.querySelector('[aria-label="Job detail"]')).toBeNull();
		yield* clickControl({ name: "Previous", role: "button" });
		yield* eventually(() => expect(content.querySelector("tbody")?.textContent).toContain("first-job"));
	},
);

adminScreens.it(
	"opens a dead-letter copy with its source and no retry",
	[retryRegistration, adminScreen()],
	function* ({ screenContent, clickControl }) {
		const content = yield* screenContent();
		yield* clickControl({ name: "Dead-lettered", role: "tab" });
		yield* eventually(() => expect(content.querySelector("tbody")?.textContent).toContain("dead-copy"));
		yield* clickControl("tbody button");
		expect(content.querySelector('[aria-label="Dead-letter detail"]')?.textContent).toContain("original-job");
		expect(content.querySelector('[aria-label="Dead-letter detail"]')?.textContent).toContain("Original failed");
		expect([...content.querySelectorAll("button")].some((button) => button.textContent === "Retry job")).toBe(false);
	},
);

adminScreens.it(
	"retries through the registered action and refreshes the failed list",
	[retryRegistration, adminScreen()],
	function* ({ screenContent, clickControl }) {
		const content = yield* screenContent();
		yield* eventually(() => expect(content.querySelector("tbody")?.textContent).toContain("retry-job"));
		yield* clickControl("tbody button");
		yield* eventually(() => expect(content.querySelector('[aria-label="Job detail"]')?.textContent).toContain("Retry job"));
		yield* clickControl({ name: "Retry job", role: "button" });
		yield* eventually(() => expect(content.textContent).toContain("No failed jobs."));
		yield* eventually(() => expect(content.querySelector('[aria-label="Job detail"]')?.textContent).toContain("Job not found."));
	},
);

adminScreens.it("reports a refused retry", [retryRegistration, adminScreen()], function* ({ screenContent, clickControl, rejectRetry }) {
	const content = yield* screenContent();
	yield* eventually(() => expect(content.querySelector("tbody")?.textContent).toContain("retry-job"));
	yield* clickControl("tbody button");
	yield* eventually(() => expect(content.querySelector('[aria-label="Job detail"]')?.textContent).toContain("Retry job"));
	yield* rejectRetry();
	yield* clickControl({ name: "Retry job", role: "button" });
	yield* eventually(() => expect(content.querySelector('[aria-label="Job detail"] [role="alert"]')?.textContent).toContain("Could not retry"));
});

adminScreens.it(
	"disposes admin subscriptions and selection on session change",
	[failedJobs, adminScreen()],
	function* ({ screenContent, clickControl, changeSession, activeAdminStreams, closeScreen }) {
		const content = yield* screenContent();
		yield* eventually(() => expect(content.querySelector("tbody")?.textContent).toContain("first-job"));
		yield* clickControl("tbody button");
		yield* eventually(() => expect(content.querySelector('[aria-label="Job detail"]')?.textContent).toContain("first-job"));
		yield* eventually(() => expect(activeAdminStreams()).toBeGreaterThan(0));
		yield* changeSession();
		yield* eventually(() => expect(content.textContent).toContain("No failed jobs."));
		expect(content.textContent).not.toContain("first-job");
		expect(content.querySelector('[aria-label="Job detail"]')).toBeNull();
		yield* eventually(() => expect(activeAdminStreams()).toBe(0));
		yield* closeScreen();
	},
);

adminScreens.it("navigates to the app's statistics page", [countedNotes, adminScreen()], function* ({ screenContent, clickControl }) {
	const content = yield* screenContent();
	yield* clickControl('nav a[href="/admin/notes"]');
	yield* eventually(() => expect(content.querySelector("h1")?.textContent).toBe("Note statistics"));
	yield* eventually(() => expect(content.querySelector("dl")?.textContent).toContain("Notes7"));
	expect(content.querySelector("dl")?.textContent).toContain("Words53");
	expect(content.querySelector("dl")?.textContent).toContain("Pending counts2");
});
